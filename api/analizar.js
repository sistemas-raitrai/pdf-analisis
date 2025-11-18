import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs/promises";
import mammoth from "mammoth";

export const config = {
  api: { bodyParser: false } // necesario para usar formidable en Vercel
};

export default async function handler(req, res) {
  console.log("📥 Iniciando análisis de contrato...");

  const form = formidable({
    keepExtensions: true,
    uploadDir: "/tmp",
    maxFileSize: 30 * 1024 * 1024
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("❌ Error al parsear el formulario:", err);
      return res.status(500).send("Error al procesar el formulario");
    }

    try {
      // Opciones (checkboxes en el front).
      const opciones = JSON.parse(fields.opciones?.[0] || "[]");

      // Instrucciones adicionales que escribió la jefa
      const extraPrompt =
        (fields.extraPrompt?.[0] || "").toString().trim();

      /* ─────────────────────────────────────────────
         1. OBTENER TEXTO: DOCX o TEXTO PEGADO
      ───────────────────────────────────────────── */

      let extractedText = "";

      // a) Intentar leer archivo DOCX (si viene)
      const fileObj = files.file?.[0] || Object.values(files)[0];

      if (fileObj && fileObj.filepath) {
        const filePath = fileObj.filepath;
        const mimeType = fileObj.mimetype;

        if (mimeType !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
          console.warn("⚠️ Tipo de archivo no DOCX, se intentará usar texto pegado.");
        } else {
          const buffer = await fs.readFile(filePath);
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value || "";
          console.log("📃 Texto extraído de DOCX. Longitud:", extractedText.length);
        }
      }

      // b) Si no hubo DOCX válido o venía vacío, usar texto pegado
      if (!extractedText) {
        const textoPegado =
          fields.texto?.[0] ||
          fields.textoManual?.[0] ||
          "";

        if (!textoPegado.trim()) {
          return res
            .status(400)
            .send("Debes subir un archivo DOCX o pegar el texto del contrato.");
        }

        extractedText = textoPegado.toString();
        console.log("📃 Texto pegado recibido. Longitud:", extractedText.length);
      }

      // Por seguridad, cortamos si es MUY largo
      const maxChars = 12000;
      const textoLimitado = extractedText.slice(0, maxChars);

      /* ─────────────────────────────────────────────
         2. ARMAR PROMPT PARA REVISIÓN DE CONTRATO
            (LEGISLACIÓN CHILENA)
      ───────────────────────────────────────────── */

      const quiereResumen      = opciones.includes("resumen");
      const focoRiesgos        = opciones.includes("riesgos");
      const focoAjustesMinimos = opciones.includes("ajustes_minimos");

      let prompt = `
Eres abogado/a con experiencia en derecho laboral y contractual chileno.

Te entregaré el texto de un contrato (o borrador de contrato) usado por una empresa en Chile. 
La jefatura que lo revisa no es abogada y NO quiere cambiar demasiado el estilo ni la estructura 
del contrato, solo corregir lo necesario.

Tu objetivo es entregar un informe claro, práctico y accionable.

1) DIAGNÓSTICO GENERAL
- Resume en 3–5 líneas el estado general del contrato:
  - ✅ Si en general está coherente y solo ves ajustes menores.
  - ⚠️ Si hay algunos riesgos o ambigüedades relevantes.
  - ❗ Si detectas problemas serios o cláusulas potencialmente muy riesgosas o discutibles.

El diagnóstico debe ser coherente con las observaciones que darás después.

2) LISTA DE OBSERVACIONES
Entrega las observaciones en viñetas, usando SIEMPRE este formato:

- [nivel] [tema]  
  • Texto actual: "frase o cláusula relevante"  
  • Riesgo / problema (en lenguaje simple).  
  • Sugerencia concreta de mejora respetando lo más posible el estilo original.

Donde:
- Usa ✅ cuando sea solo mejora de redacción/claridad.  
- Usa ⚠️ cuando haya un riesgo moderado.  
- Usa ❗ cuando el riesgo sea alto para la empresa.

Prioriza especialmente:
- Definición de funciones y obligaciones de cada parte.
- Responsabilidad de la empresa y de la otra parte.
- Causales y forma de término anticipado.
- Cláusulas de confidencialidad, no competencia y propiedad intelectual.
- Jurisdicción, resolución de conflictos y ley aplicable.
- Plazos, montos, reajustes, intereses, multas, descuentos, etc.

NO reescribas el contrato completo.
NO prometas que algo es “100% legal”; usa expresiones como 
“podría ser riesgoso”, “podría interpretarse”, “podría discutirse”, etc.,
siempre en contexto de legislación chilena vigente.
`;

      if (focoRiesgos) {
        prompt += `
Además, enfatiza en las cláusulas que puedan ser más riesgosas para la EMPRESA, 
explicando claramente por qué y qué alternativas podrían considerarse.  
`;
      }

      if (focoAjustesMinimos) {
        prompt += `
Recuerda que la idea es hacer AJUSTES MÍNIMOS: cuando sugieras cambios, intenta 
mantener la estructura y el tono del texto original, cambiando solo lo necesario 
para ganar claridad y reducir riesgos.  
`;
      }

      if (quiereResumen) {
        prompt += `
Al final de tu respuesta agrega un apartado "RESUMEN EJECUTIVO" con máximo 10 viñetas, 
pensado para una jefatura ocupada (sin tecnicismos legales).  
`;
      }

      // 🔹 Instrucciones adicionales de la usuaria (si escribió algo)
      if (extraPrompt) {
        prompt += `
INSTRUCCIONES ADICIONALES DE LA USUARIA:
"${extraPrompt}"

Ten especialmente en cuenta estas indicaciones para priorizar tu análisis
y tus comentarios.  
`;
      }

      prompt += `

TEXTO DEL CONTRATO A ANALIZAR
(Recuerda: no reescribas todo, solo analiza y comenta según lo anterior):

${textoLimitado}
`;

      /* ─────────────────────────────────────────────
         3. LLAMADO A OPENAI
      ───────────────────────────────────────────── */

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      });

      const resultText = response.choices[0].message.content;
      console.log("✅ Análisis de contrato completado.");
      return res.status(200).send(resultText);

    } catch (error) {
      console.error("❌ Error interno:", error);
      return res.status(500).send("Error al procesar el archivo.");
    }
  });
}
