import * as fs from "node:fs";
import * as path from "node:path";

const HTML_PATH = path.resolve("public/cycani-favs.html");
const OUTPUT_PATH = path.resolve("public/anime-list.json");
const BANGUMI_SEARCH = "https://bgmapi.anibt.net/v0/search/subjects";

interface CycaniItem {
	title: string;
	cover: string;
	link: string;
	category: string;
	dataId: string;
}

function parseHtml(html: string): CycaniItem[] {
	const items: CycaniItem[] = [];
	const blocks = html.split('<div class="public-list-box public-pic-b');

	for (let i = 1; i < blocks.length; i++) {
		const block = blocks[i];

		const dataIdMatch = block.match(/data-id="(\d+)"/);
		const dataId = dataIdMatch ? dataIdMatch[1] : "";

		const hrefMatch = block.match(/class="public-list-exp"\s+href="([^"]+)"/);
		const href = hrefMatch ? hrefMatch[1] : "";

		const altMatch = block.match(/<img[^>]*alt="([^"]*)"/);
		const title = altMatch ? altMatch[1] : "";

		const dataSrcMatch = block.match(/data-src="(https:\/\/[^"]*\.(?:jpg|webp|avif|png)[^"]*)"/);
		const srcMatch = block.match(/src="(https:\/\/[^"]*\.(?:jpg|webp|avif|png)[^"]*)"/);
		let cover = dataSrcMatch ? dataSrcMatch[1] : (srcMatch ? srcMatch[1] : "");
		cover = cover.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

		const catMatch = block.match(/<span[^>]*class="[^"]*ft2[^"]*"[^>]*>([^<]*)<\/span>/);
		const category = catMatch ? catMatch[1].trim() : "";

		if (title) {
			items.push({ title, cover, link: href, category, dataId });
		}
	}

	return items;
}

interface BangumiSubject {
	id: number;
	name: string;
	name_cn: string;
	images?: { large?: string; common?: string; medium?: string };
	rating?: { score: number; total: number };
	summary?: string;
	date?: string;
}

/** Extract Bangumi subject ID from cycani cover URL (e.g. .../480441_6o9oX.jpg → 480441) */
function extractBangumiId(coverUrl: string): string | null {
	const match = coverUrl.match(/\/(\d+)_[^\/]+\.(?:jpg|webp|avif|png)/);
	return match ? match[1] : null;
}

async function fetchBangumiById(id: string): Promise<BangumiSubject | null> {
	try {
		const resp = await fetch(`https://bgmapi.anibt.net/v0/subjects/${id}`, {
			headers: { "User-Agent": "FireflyBlog/1.0" },
		});
		if (!resp.ok) return null;
		return await resp.json();
	} catch {
		return null;
	}
}

async function searchBangumi(title: string): Promise<BangumiSubject | null> {
	try {
		const resp = await fetch(`${BANGUMI_SEARCH}?keyword=${encodeURIComponent(title)}&type=2&limit=1`, {
			headers: { "User-Agent": "FireflyBlog/1.0" },
		});
		if (!resp.ok) return null;
		const data = await resp.json();
		const subjects = data.data || [];
		if (subjects.length === 0) return null;

		// Fetch details for rating
		const subjectId = subjects[0].id;
		const detailResp = await fetch(`https://bgmapi.anibt.net/v0/subjects/${subjectId}`, {
			headers: { "User-Agent": "FireflyBlog/1.0" },
		});
		if (!detailResp.ok) return subjects[0];
		return await detailResp.json();
	} catch {
		return null;
	}
}

async function main() {
	if (!fs.existsSync(HTML_PATH)) {
		console.log(`[Cycani] HTML file not found.`);
		fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ items: [] }, null, 2));
		return;
	}

	const html = fs.readFileSync(HTML_PATH, "utf-8");
	const cycaniItems = parseHtml(html);
	console.log(`[Cycani] Parsed ${cycaniItems.length} items`);

	// Enrich with Bangumi data
	const enriched = [];
	for (const item of cycaniItems) {
		console.log(`[Bangumi] Processing: ${item.title}...`);

		// Try direct ID extraction from cover URL first
		const bgmId = extractBangumiId(item.cover);
		let bgm: BangumiSubject | null = null;
		if (bgmId) {
			bgm = await fetchBangumiById(bgmId);
			if (bgm) console.log(`  -> Found by ID ${bgmId}: ${bgm.name_cn || bgm.name} | Rating: ${bgm.rating?.score || 0}`);
		}
		// Fallback to search
		if (!bgm) {
			bgm = await searchBangumi(item.title);
			if (bgm) console.log(`  -> Found by search: ${bgm.name_cn || bgm.name} | Rating: ${bgm.rating?.score || 0}`);
		}
		if (!bgm) console.log(`  -> Not found on Bangumi`);

		const cover = item.cover || bgm?.images?.large || bgm?.images?.common || "";
		const rating = bgm?.rating?.score || 0;
		const summary = bgm?.summary || "";
		const date = bgm?.date || "";

		enriched.push({
			id: item.dataId,
			title: bgm?.name_cn || item.title,
			originalTitle: bgm?.name || "",
			poster: cover || null,
			type: item.category.includes("剧场") ? "movie" : "tv",
			season_type: item.category.includes("剧场") ? 2 : 1,
			source: "cycani",
			rating,
			date,
			overview: summary,
			link: item.link || "",
			epStatus: null,
		});
	}

	fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ items: enriched }, null, 2));
	console.log(`[Cycani] Written ${enriched.length} items to ${OUTPUT_PATH}`);
}

main();
