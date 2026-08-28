import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const uiDirectory = path.resolve(scriptDirectory, "..");
const messagesDirectory = path.join(uiDirectory, "messages");
const sourceLocale = "en";
const targets = {
  "zh-CN": "Simplified Chinese",
  ja: "Japanese",
};
const lockPath = path.join(messagesDirectory, ".i18n-lock.json");

function flattenMessages(value, prefix = "", result = {}) {
  for (const [key, entry] of Object.entries(value)) {
    const messageKey = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "string") {
      result[messageKey] = entry;
    } else if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      flattenMessages(entry, messageKey, result);
    } else {
      throw new Error(`Message "${messageKey}" must be a string or object.`);
    }
  }
  return result;
}

function rebuildMessages(source, translations, prefix = "") {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => {
      const messageKey = prefix ? `${prefix}.${key}` : key;
      return [
        key,
        typeof value === "string"
          ? translations[messageKey]
          : rebuildMessages(value, translations, messageKey),
      ];
    }),
  );
}

function sourceHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function messageVariables(value) {
  return [
    ...value.matchAll(/\{\s*([A-Za-z_][\w.-]*)\s*(?:,|\})/g),
  ]
    .map((match) => match[1])
    .sort();
}

function validateVariables(key, source, translated, locale) {
  const expected = messageVariables(source);
  const actual = messageVariables(translated);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${locale} message "${key}" changed variables: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    );
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadCatalogs() {
  const source = await readJson(path.join(messagesDirectory, "en.json"));
  const localized = {};
  for (const locale of Object.keys(targets)) {
    localized[locale] = await readJson(
      path.join(messagesDirectory, `${locale}.json`),
    );
  }
  return { source, localized };
}

async function loadLock() {
  try {
    return { exists: true, value: await readJson(lockPath) };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        exists: false,
        value: { version: 1, sourceLocale, targets: {} },
      };
    }
    throw error;
  }
}

function catalogErrors(sourceFlat, targetFlat, locale, hashes) {
  const errors = [];
  const sourceKeys = Object.keys(sourceFlat);
  const sourceKeySet = new Set(sourceKeys);

  for (const key of sourceKeys) {
    const translated = targetFlat[key];
    if (typeof translated !== "string" || translated.trim() === "") {
      errors.push(`${locale}: missing or empty "${key}"`);
      continue;
    }
    try {
      validateVariables(key, sourceFlat[key], translated, locale);
    } catch (error) {
      errors.push(error.message);
    }
    if (hashes?.[key] !== sourceHash(sourceFlat[key])) {
      errors.push(`${locale}: stale translation "${key}"`);
    }
  }

  for (const key of Object.keys(targetFlat)) {
    if (!sourceKeySet.has(key)) {
      errors.push(`${locale}: obsolete key "${key}"`);
    }
  }
  return errors;
}

async function loadEnvironment() {
  for (const filename of [".env.local", ".env"]) {
    try {
      const contents = await readFile(path.join(uiDirectory, filename), "utf8");
      for (const line of contents.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match || process.env[match[1]] !== undefined) continue;
        let value = match[2];
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[match[1]] = value;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function completionEndpoint(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function parseTranslationResponse(content) {
  const trimmed = content.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Translation API did not return a JSON object.");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function translateBatch(entries, locale, language) {
  const baseUrl = process.env.I18N_TRANSLATION_API_BASE;
  const model = process.env.I18N_TRANSLATION_MODEL;
  if (!baseUrl || !model) {
    throw new Error(
      "Translations are stale. Set I18N_TRANSLATION_API_BASE and I18N_TRANSLATION_MODEL, then run bun run i18n:sync.",
    );
  }

  const headers = { "Content-Type": "application/json" };
  if (process.env.I18N_TRANSLATION_API_KEY) {
    headers.Authorization = `Bearer ${process.env.I18N_TRANSLATION_API_KEY}`;
  }

  const input = Object.fromEntries(entries);
  const response = await fetch(completionEndpoint(baseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            `Translate Dingent interface messages from English to ${language}.`,
            "Return one JSON object with exactly the same keys.",
            "Preserve ICU variables such as {name} and {count}, HTML-like tags, product names, protocol names, file paths, URLs, and keyboard shortcuts.",
            "Translate interface text only. Do not add explanations.",
          ].join(" "),
        },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Translation API returned ${response.status}: ${await response.text()}`,
    );
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Translation API response is missing choices[0].message.content.");
  }

  const translated = parseTranslationResponse(content);
  const expectedKeys = entries.map(([key]) => key).sort();
  const actualKeys = Object.keys(translated).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `${locale} translation returned unexpected keys. Expected ${JSON.stringify(expectedKeys)}, received ${JSON.stringify(actualKeys)}.`,
    );
  }

  for (const [key, source] of entries) {
    if (typeof translated[key] !== "string" || translated[key].trim() === "") {
      throw new Error(`${locale} translation for "${key}" is empty.`);
    }
    validateVariables(key, source, translated[key], locale);
  }
  return translated;
}

async function check() {
  const { source, localized } = await loadCatalogs();
  const lock = await loadLock();
  if (!lock.exists) {
    throw new Error(
      "Translation lock is missing. Run bun run i18n:sync once to initialize it.",
    );
  }

  const sourceFlat = flattenMessages(source);
  const errors = [];
  for (const locale of Object.keys(targets)) {
    errors.push(
      ...catalogErrors(
        sourceFlat,
        flattenMessages(localized[locale]),
        locale,
        lock.value.targets?.[locale],
      ),
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Translation catalogs are out of sync:\n- ${errors.join("\n- ")}\nRun bun run i18n:sync.`,
    );
  }
  console.log(`i18n check passed: ${Object.keys(sourceFlat).length} messages.`);
}

async function sync() {
  await loadEnvironment();
  const { source, localized } = await loadCatalogs();
  const lock = await loadLock();
  const sourceFlat = flattenMessages(source);
  const sourceKeys = Object.keys(sourceFlat);
  const nextCatalogs = {};
  const nextHashes = {};
  const batchSize = Math.max(
    1,
    Number.parseInt(process.env.I18N_TRANSLATION_BATCH_SIZE ?? "20", 10) || 20,
  );
  let translatedCount = 0;

  for (const [locale, language] of Object.entries(targets)) {
    const targetFlat = flattenMessages(localized[locale]);
    const previousHashes = lock.value.targets?.[locale];
    const isInitialized = Boolean(previousHashes);
    const pending = sourceKeys.filter((key) => {
      const missing =
        typeof targetFlat[key] !== "string" || targetFlat[key].trim() === "";
      const changed =
        isInitialized &&
        previousHashes[key] !== sourceHash(sourceFlat[key]);
      return missing || changed;
    });

    for (let index = 0; index < pending.length; index += batchSize) {
      const keys = pending.slice(index, index + batchSize);
      const entries = keys.map((key) => [key, sourceFlat[key]]);
      console.log(
        `Translating ${locale}: ${index + 1}-${index + entries.length} of ${pending.length}`,
      );
      Object.assign(
        targetFlat,
        await translateBatch(entries, locale, language),
      );
      translatedCount += entries.length;
    }

    for (const key of sourceKeys) {
      const value = targetFlat[key];
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`${locale} message "${key}" is missing after sync.`);
      }
      validateVariables(key, sourceFlat[key], value, locale);
    }

    nextCatalogs[locale] = rebuildMessages(source, targetFlat);
    nextHashes[locale] = Object.fromEntries(
      sourceKeys.map((key) => [key, sourceHash(sourceFlat[key])]),
    );
  }

  for (const locale of Object.keys(targets)) {
    const output = `${JSON.stringify(nextCatalogs[locale], null, 2)}\n`;
    const filePath = path.join(messagesDirectory, `${locale}.json`);
    const current = await readFile(filePath, "utf8");
    if (current !== output) {
      await writeFile(filePath, output, "utf8");
    }
  }

  await writeFile(
    lockPath,
    `${JSON.stringify(
      {
        version: 1,
        sourceLocale,
        targets: nextHashes,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    `i18n sync complete: ${sourceKeys.length} messages, ${translatedCount} translations requested.`,
  );
}

const command = process.argv[2];
if (command === "check") {
  await check();
} else if (command === "sync") {
  await sync();
} else {
  throw new Error("Usage: node scripts/i18n.mjs <sync|check>");
}
