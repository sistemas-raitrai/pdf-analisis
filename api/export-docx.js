import { Document, Packer, Paragraph, TextRun } from "docx";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const { contenido } = req.body || {};

    if (!contenido || typeof contenido !== "string") {
      return res.status(400).send("No se recibió contenido válido para exportar.");
    }

    // Separar el texto por líneas para generar párrafos
    const lineas = contenido.split(/\r?\n/);

    const paragraphs = lineas.map((linea) => {
      const text = linea.replace(/\s+$/,""); // limpiar espacios finales
      // Línea vacía → párrafo vacío (salto)
      if (!text) {
        return new Paragraph("");
      }
      return new Paragraph({
        children: [
          new TextRun({
            text,
            font: "Calibri",     // lo puedes cambiar
            size: 22             // 22 = 11pt (docx *2)
          })
        ]
      });
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs
        }
      ]
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="informe-contrato.docx"'
    );

    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("❌ Error generando DOCX:", error);
    return res.status(500).send("Error interno al generar el archivo DOCX.");
  }
}
