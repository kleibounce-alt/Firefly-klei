import * as fs from "node:fs";
import * as path from "node:path";

const HTML_PATH = path.resolve("public/cycani-favs.html");
const OUTPUT_PATH = path.resolve("public/anime-list.json");

interface CycaniItem {
	title: string;
	cover: string;
	link: string;
	category: string;
	dataId: string;
}

function parseHtml(html: string): CycaniItem[] {
	const items: CycaniItem[] = [];

	// Split by public-list-box boundary
	const blocks = html.split('<div class="public-list-box public-pic-b');

	for (let i = 1; i < blocks.length; i++) {
		const block = blocks[i];

		// data-id
		const dataIdMatch = block.match(/data-id="(\d+)"/);
		const dataId = dataIdMatch ? dataIdMatch[1] : "";

		// href from public-list-exp
		const hrefMatch = block.match(/class="public-list-exp"\s+href="([^"]+)"/);
		const href = hrefMatch ? hrefMatch[1] : "";

		// title from img alt
		const altMatch = block.match(/<img[^>]*alt="([^"]*)"/);
		const title = altMatch ? altMatch[1] : "";

		// cover from data-src (preferred) or src
		const dataSrcMatch = block.match(/data-src="(https:\/\/[^"]*\.(?:jpg|webp|avif|png)[^"]*)"/);
		const srcMatch = block.match(/src="(https:\/\/[^"]*\.(?:jpg|webp|avif|png)[^"]*)"/);
		const cover = dataSrcMatch ? dataSrcMatch[1] : (srcMatch ? srcMatch[1] : "");

		// category from ft2 span
		const catMatch = block.match(/<span[^>]*class="[^"]*ft2[^"]*"[^>]*>([^<]*)<\/span>/);
		const category = catMatch ? catMatch[1].trim() : "";

		if (title) {
			items.push({ title, cover, link: href, category, dataId });
		}
	}

	return items;
}

function main() {
	if (!fs.existsSync(HTML_PATH)) {
		console.log(`[Cycani] HTML file not found.`);
		fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ items: [] }, null, 2));
		return;
	}

	const html = fs.readFileSync(HTML_PATH, "utf-8");
	const items = parseHtml(html);

	console.log(`[Cycani] Parsed ${items.length} items:`);
	for (const item of items) {
		console.log(`  - ${item.title} [${item.category}]`);
	}

	fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ items }, null, 2));
	console.log(`[Cycani] Written to ${OUTPUT_PATH}`);
}

main();
