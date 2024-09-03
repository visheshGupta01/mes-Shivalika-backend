//excelParser.js

const xlsx = require("xlsx");

const parseExcelFile = async (buffer) => {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheets = workbook.SheetNames;
  console.log(sheets)
  const products = [];

  const parseDate = (date) => {
    if (!date) return null;

    if (typeof date === "number") {
      const epoch = new Date(1899, 11, 30);
      return new Date(epoch.getTime() + date * 86400000);
    }

    const parsedDate = new Date(date);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  };

  for (const sheet of sheets) {
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet], {
      defval: "",
    });
    

    for (const row of data) {
      try {
        const {
          Image: image,
          "SR NO.": srNo,
          BUYER: buyer,
          "BUYER PO": buyerPO,
          COLOUR: color,
          "EX-FECT": exFactoryDate,
          ARTICLE: styleName,
          SIZE: size,
          QTY: quantity,
          PROCESSES: processes,
        } = row;

        products.push({
          image: image || null,
          srNo: srNo || "",
          buyer: buyer || "",
          buyerPO: buyerPO || "",
          color: color || "",
          exFactoryDate: exFactoryDate ? parseDate(exFactoryDate) : null,
          styleName: styleName || "",
          size: size || "",
          quantity: quantity || 0,
          processes: processes ? processes.split(",").map((p) => p.trim()) : [],
        });
      } catch (error) {
        console.error("Error processing row:", row, error);
      }
    }
  }

  return products;
};

module.exports = { parseExcelFile };
