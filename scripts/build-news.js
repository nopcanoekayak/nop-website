const fs = require("fs");
const path = require("path");

const NEWS_DIR = path.join(
  process.cwd(),
  "content",
  "news"
);

const OUTPUT_FILE = path.join(
  process.cwd(),
  "news-data.json"
);


/* ==========================================================
   PARSE FRONT MATTER
   ========================================================== */

function parseFrontMatter(content) {

  const match = content.match(
    /^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/
  );


  if (!match) {

    return {
      data: {},
      body: content.trim()
    };

  }


  const frontMatter =
    match[1];

  const body =
    match[2].trim();


  const data = {};

  let currentKey = null;


  /*
   * Διαβάζουμε το front matter γραμμή-γραμμή.
   *
   * Εάν μια γραμμή ΔΕΝ έχει ":",
   * θεωρούμε ότι είναι συνέχεια του
   * προηγούμενου πεδίου.
   *
   * Αυτό προστατεύει ειδικά τους μεγάλους
   * ελληνικούς τίτλους που μπορεί να έχουν
   * αποθηκευτεί σε περισσότερες από μία γραμμές.
   */

  for (
    const rawLine of frontMatter.split(/\r?\n/)
  ) {

    const line =
      rawLine.trim();


    if (!line) {
      continue;
    }


    const separator =
      line.indexOf(":");


    /*
     * Νέα ιδιότητα
     */

    if (separator !== -1) {

      const key =
        line
          .slice(
            0,
            separator
          )
          .trim();


      let value =
        line
          .slice(
            separator + 1
          )
          .trim();


      /*
       * Αφαιρούμε εισαγωγικά
       * όταν το value είναι quoted.
       */

      if (

        (
          value.startsWith('"') &&
          value.endsWith('"')
        )

        ||

        (
          value.startsWith("'") &&
          value.endsWith("'")
        )

      ) {

        value =
          value.slice(
            1,
            -1
          );

      }


      data[key] =
        value;


      currentKey =
        key;


      continue;
    }


    /*
     * Συνέχεια προηγούμενης ιδιότητας.
     *
     * Αυτό είναι ιδιαίτερα σημαντικό για
     * μεγάλους ελληνικούς τίτλους.
     */

    if (
      currentKey &&
      line
    ) {

      data[currentKey] =
        (
          String(
            data[currentKey] || ""
          ).trim() +

          " " +

          line
        ).trim();

    }

  }


  return {
    data,
    body
  };

}


/* ==========================================================
   STRIP MARKDOWN
   ========================================================== */

function stripMarkdown(text) {

  return String(
    text || ""
  )

    /*
     * Images
     */

    .replace(
      /!\[[^\]]*\]\([^)]*\)/g,
      ""
    )

    /*
     * Links
     */

    .replace(
      /\[([^\]]*)\]\([^)]*\)/g,
      "$1"
    )

    /*
     * Headings
     */

    .replace(
      /#{1,6}\s+/g,
      ""
    )

    /*
     * Markdown symbols
     */

    .replace(
      /[*_`~]/g,
      ""
    )

    /*
     * New lines
     */

    .replace(
      /\r?\n+/g,
      " "
    )

    /*
     * Multiple spaces
     */

    .replace(
      /\s+/g,
      " "
    )

    .trim();

}


/* ==========================================================
   ESCAPE HTML
   ========================================================== */

function escapeHtml(text) {

  return String(
    text || ""
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


/* ==========================================================
   WALK NEWS DIRECTORY
   ========================================================== */

function walkNewsDirectory(dir) {

  if (!fs.existsSync(dir)) {

    return [];

  }


  const entries =
    fs.readdirSync(
      dir,
      {
        withFileTypes: true
      }
    );


  const result = [];


  for (
    const entry of entries
  ) {

    const fullPath =
      path.join(
        dir,
        entry.name
      );


    /*
     * Recursive folders
     */

    if (
      entry.isDirectory()
    ) {

      /*
       * Οι εικόνες δεν είναι άρθρα.
       */

      if (
        entry.name === "uploads"
      ) {

        continue;

      }


      result.push(
        ...walkNewsDirectory(
          fullPath
        )
      );


      continue;

    }


    /*
     * Μόνο Markdown άρθρα
     */

    if (

      !entry.isFile() ||

      !entry.name.endsWith(
        ".md"
      )

    ) {

      continue;

    }


    const raw =
      fs.readFileSync(
        fullPath,
        "utf8"
      );


    const {
      data,
      body
    } =
      parseFrontMatter(
        raw
      );


    const slug =
      entry.name.replace(
        /\.md$/,
        ""
      );


    /*
     * ======================================================
     * EXCERPT
     * ======================================================
     *
     * Εάν το CMS έχει κανονικά πεδίο excerpt,
     * το χρησιμοποιούμε.
     *
     * Εάν το excerpt είναι ΕΝΤΕΛΩΣ ΚΕΝΟ,
     * παραμένει κενό.
     *
     * Δεν παίρνουμε πλέον αυτόματα 220 χαρακτήρες
     * από το body.
     */

    let excerpt = "";


    if (
      Object.prototype.hasOwnProperty.call(
        data,
        "excerpt"
      )
    ) {

      excerpt =
        String(
          data.excerpt || ""
        ).trim();

    }


    /*
     * ======================================================
     * ARTICLE
     * ======================================================
     */

    const article = {

      slug,

      /*
       * Ο τίτλος αποθηκεύεται αυτούσιος.
       * Δεν γίνεται slice, substring ή όριο λέξεων.
       */

      title:
        String(
          data.title ||
          "Χωρίς τίτλο"
        ).trim(),

      date:
        String(
          data.date ||
          ""
        ).trim(),

      category:
        String(
          data.category ||
          "Νέα"
        ).trim(),

      image:
        String(
          data.image ||
          ""
        ).trim(),

      excerpt,

      body

    };


    result.push(
      article
    );

  }


  return result;

}


/* ==========================================================
   LOAD ARTICLES
   ========================================================== */

const articles =
  walkNewsDirectory(
    NEWS_DIR
  );


/* ==========================================================
   SORT BY DATE
   ========================================================== */

articles.sort(
  function (
    a,
    b
  ) {

    return (
      new Date(
        b.date || 0
      )

      -

      new Date(
        a.date || 0
      )
    );

  }
);


/* ==========================================================
   WRITE JSON
   ========================================================== */

fs.writeFileSync(

  OUTPUT_FILE,

  JSON.stringify(
    articles,
    null,
    2
  ),

  "utf8"

);


/* ==========================================================
   LOG
   ========================================================== */

console.log(

  `Generated news-data.json with ${articles.length} article(s).`

);