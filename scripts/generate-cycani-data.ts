import * as fs from "node:fs";
import * as path from "node:path";

const HTML_PATH = path.resolve("public/cycani-favs.html");
const OUTPUT_PATH = path.resolve("public/anime-list.json");
const BASE_URL = "https://www.cycani.org";

interface CycaniItem {
	title: string;
	cover: string;
	link: string;
	category: string;
	dataId: string;
}

function parseHtml(html: string): CycaniItem[] {
	const items: CycaniItem[] = [];

	// Match each public-list-box block
	const boxRegex = /<div class="public-list-box public-pic-b[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
	let match: RegExpExecArray | null;

	while ((match = boxRegex.exec(html)) !== null) {
		const block = match[1];

		// Extract data-id
		const dataIdMatch = block.match(/data-id="(\d+)"/);
		const dataId = dataIdMatch ? dataIdMatch[1] : "";

		// Extract href
		const hrefMatch = block.match(/href="(\/bangumi\/\d+\.html)"/);
		const href = hrefMatch ? hrefMatch[1] : "";

		// Extract img alt (title)
		const altMatch = block.match(/alt="([^"]*)"/);
		const title = altMatch ? altMatch[1] : "";

		// Extract img src
		const srcMatch = block.match(/src="(https:\/\/[^"]*\.(?:jpg|webp|avif|png)[^"]*)"/);
		const cover = srcMatch ? srcMatch[1] : "";

		// Extract category from span.ft2
		const catMatch = block.match(/<span class="[^"]*ft2[^"]*">([^<]*)<\/span>/);
		const category = catMatch ? catMatch[1].trim() : "";

		if (title && href) {
			items.push({
				title,
				cover,
				link: BASE_URL + href,
				category,
				dataId,
			});
		}
	}

	return items;
}

function main() {
	if (!fs.existsSync(HTML_PATH)) {
		console.log(`[Cycani] HTML file not found at ${HTML_PATH}, skipping.`);
		console.log(
			"[Cycani] Save your favs page from https://www.cycani.org/user/favs.html to public/cycani-favs.html",
		);
		// Write empty array so build doesn't fail
		fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ items: [] }, null, 2));
		return;
	}

	const html = fs.readFileSync(HTML_PATH, "utf-8");
	const items = parseHtml(html);

	console.log(`[Cycani] Parsed ${items.length} items from cycani-favs.html`);
	for (const item of items) {
		console.log(`  - ${item.title} [${item.category}]`);
	}

	fs.writeFileSync(
		OUTPUT_PATH,
		JSON.stringify({ items }, null, 2),
	);
	console.log(`[Cycani] Written to ${OUTPUT_PATH}`);
}

main();
