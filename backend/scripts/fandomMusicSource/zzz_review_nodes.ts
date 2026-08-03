import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

interface NodeRow {
  id: number;
  cat: string;
  name: string;
  ename: string;
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "15433"),
    user: process.env.DB_USER || "sumicowork",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hoyomusic",
  });
  await client.connect();

  const res = await client.query(
    `SELECT mc.name cat, mn.id, mn.name, mn.en_name as ename FROM music_source_nodes mn 
     JOIN music_source_categories mc ON mc.id = mn.category_id 
     WHERE mc.game_id = 3 ORDER BY mc.name, mn.id`
  );

  const rows: NodeRow[] = res.rows;
  console.log(`Total nodes: ${rows.length}\n`);

  // === ANALYSIS ===
  let issuesFound = 0;

  for (const r of rows) {
    const problems: string[] = [];
    const n = r.name;
    const e = r.ename;

    // 1. Garbage punctuation / formatting
    if (n.startsWith(",") || n.startsWith("and ") || n.startsWith(", ")) problems.push("LEADING_GARBAGE");
    if (n.startsWith("\"") && !n.includes("\"", 1)) problems.push("MISMATCHED_QUOTE");
    if (n.match(/\s{2,}/)) problems.push("DOUBLE_SPACE");
    if (n.trim() !== n) problems.push("LEADING_TRAILING_SPACE");
    if (n.includes(" , ")) problems.push("SPACE_COMMA_SPACE");
    if (n.includes(";;")) problems.push("UNSPLIT_DBL_SEMICOLON");
    if (n.includes(" | ") && n.includes(", ")) problems.push("PIPE_AND_COMMA_MIX");
    if (n.match(/\x01|\x02/)) problems.push("CONTROL_CHARS");
    if (n.match(/[。，；：！？、]/) && n.match(/[.,;:!?]/)) problems.push("MIXED_PUNCTUATION");
    if (n.match(/^\s*\(/) || n.match(/^\s*\)/)) problems.push("STRAY_PAREN");
    if (n.startsWith("- ") || n.startsWith(" -")) problems.push("LEADING_DASH");

    // 2. Chinese + English mixing that creates nonsense
    const hasCN = /[\u4e00-\u9fff]/.test(n);
    const hasEN = /[A-Za-z]{3,}/.test(n);
    if (hasCN && hasEN) {
      // Check specific patterns that indicate broken mixing
      if (n.match(/[\u4e00-\u9fff][a-zA-Z]/) && !n.match(/EP|MV|HDD|TV|QTE|CM|PV/)) {
        problems.push("CN_EN_NOSPACE");
      }
      if (n.includes("的") && n.includes("'s")) problems.push("MIXED_POSSESSIVE");
      if (n.match(/^[A-Z][a-z]+ [\u4e00-\u9fff]/)) problems.push("EN_CN_MIX_START");
    }

    // 3. Incorrect splitting — check en_name for remnants
    if (e.startsWith("and ")) problems.push("ENAME_AND_PREFIX");
    if (e.startsWith(", ")) problems.push("ENAME_COMMA_PREFIX");
    if (n.length < 5 && e.length > 10) problems.push("TRUNCATED_NAME");

    // 4. Specific bad patterns
    if (n.includes("\u7684\u0027s")) problems.push("的'\"'\"'s_MIX"); // 的's
    if (n.match(/[a-z][\u4e00-\u9fff]|[a-z][\u4e00-\u9fff]/) && n.match(/[\u4e00-\u9fff][a-z]/)) {
      // Complex mixing — flag for review
    }

    // 5. Brackets balance
    const openParen = (n.match(/\(/g)||[]).length;
    const closeParen = (n.match(/\)/g)||[]).length;
    if (openParen !== closeParen) problems.push("UNBALANCED_PARENS");
    const openBracket = (n.match(/\[/g)||[]).length;
    const closeBracket = (n.match(/\]/g)||[]).length;
    if (openBracket !== closeBracket) problems.push("UNBALANCED_BRACKETS");
    const openQuote = (n.match(/"/g)||[]).length;
    if (openQuote % 2 !== 0) problems.push("UNBALANCED_QUOTES");

    // 6. Meaningless single-word nodes
    if (n.length <= 4 && hasCN && !/\w{3}/.test(n) && !problems.length) {
      // Short Chinese-only name — probably fine
    } else if (n.length <= 3 && !hasCN && /^[A-Za-z ]+$/.test(n)) {
      // Very short English-only — could be a remnant
    }

    if (problems.length > 0) {
      issuesFound++;
      console.log(`[${r.cat}] #${r.id}`);
      console.log(`  NAME:  ${n}`);
      console.log(`  ENAME: ${e}`);
      console.log(`  ISSUES: ${problems.join(", ")}`);
      console.log();
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total nodes: ${rows.length}`);
  console.log(`Issues found: ${issuesFound}`);
  console.log(`Clean nodes: ${rows.length - issuesFound}`);

  // Category breakdown
  const cats = new Map<string, number>();
  for (const r of rows) cats.set(r.cat, (cats.get(r.cat)||0)+1);
  for (const [cat, cnt] of cats) console.log(`  ${cat}: ${cnt}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
