/**
 * BOOT LOADER
 * サーバーからレスポンスされるHTMLに埋め込まれるスクリプトで、以下の役割を持ちます。
 * - 翻訳ファイルをフェッチする。
 * - バージョンに基づいて適切なメインスクリプトを読み込む。
 * - キャッシュされたコンパイル済みテーマを適用する。
 * - クライアントの設定値に基づいて対応するHTMLクラス等を設定する。
 * テーマをこの段階で設定するのは、メインスクリプトが読み込まれる間もテーマを適用したいためです。
 * 注: webpackは介さないため、このファイルではrequireやimportは使えません。
 */

'use strict';

// ブロックの中に入れないと、定義した変数がブラウザのグローバルスコープに登録されてしまい邪魔なので
(async () => {
	window.onerror = (e) => {
		renderError('SOMETHING_HAPPENED', e.toString());
	};
	window.onunhandledrejection = (e) => {
		renderError('SOMETHING_HAPPENED_IN_PROMISE', e.toString());
	};

	const v = localStorage.getItem('v') || VERSION;

	//#region Detect language & fetch translations
	const localeVersion = localStorage.getItem('localeVersion');
	const localeOutdated = (localeVersion == null || localeVersion !== v);

	if (!localStorage.hasOwnProperty('locale') || localeOutdated) {
		const supportedLangs = LANGS;
		let lang = localStorage.getItem('lang');
		if (lang == null || !supportedLangs.includes(lang)) {
			if (supportedLangs.includes(navigator.language)) {
				lang = navigator.language;
			} else {
				lang = supportedLangs.find(x => x.split('-')[0] === navigator.language);

				// Fallback
				if (lang == null) lang = 'en-US';
			}
		}

		const res = await fetch(`/assets/locales/${lang}.${v}.json`);
		if (res.status === 200) {
			localStorage.setItem('lang', lang);
			localStorage.setItem('locale', await res.text());
			localStorage.setItem('localeVersion', v);
		} else {
			await checkUpdate();
			renderError('LOCALE_FETCH_FAILED');
			return;
		}
	}
	//#endregion

	//#region Script
	import(`/assets/${CLIENT_ENTRY}`)
		.catch(async e => {
			await checkUpdate();
			renderError('APP_FETCH_FAILED', JSON.stringify(e));
		})
	//#endregion

	//#region Theme
	const theme = localStorage.getItem('theme');
	if (theme) {
		for (const [k, v] of Object.entries(JSON.parse(theme))) {
			document.documentElement.style.setProperty(`--${k}`, v.toString());

			// HTMLの theme-color 適用
			if (k === 'htmlThemeColor') {
				for (const tag of document.head.children) {
					if (tag.tagName === 'META' && tag.getAttribute('name') === 'theme-color') {
						tag.setAttribute('content', v);
						break;
					}
				}
			}
		}
	}
	//#endregion

	const fontSize = localStorage.getItem('fontSize');
	if (fontSize) {
		document.documentElement.classList.add('f-' + fontSize);
	}

	const useSystemFont = localStorage.getItem('useSystemFont');
	if (useSystemFont) {
		document.documentElement.classList.add('useSystemFont');
	}

	const wallpaper = localStorage.getItem('wallpaper');
	if (wallpaper) {
		document.documentElement.style.backgroundImage = `url(${wallpaper})`;
	}

	const customCss = localStorage.getItem('customCss');
	if (customCss && customCss.length > 0) {
		const style = document.createElement('style');
		style.innerHTML = customCss;
		document.head.appendChild(style);
	}

	// eslint-disable-next-line no-inner-declarations
	function renderError(code, details) {
		document.documentElement.innerHTML = `
			<h1>⚠문제가 발생했습니다 / エラーが発生しました</h1>

			Language:
			<input type="radio" name="lang" id="ko-KR" value="ko-KR" checked>
			<label for="korean">한국어</label>
			<input type="radio" name="lang" id="ja-JP" value="ko-KR">
			<label for="korean">日本語</label>
			<input type="radio" name="lang" id="en" value="en">
			<label for="korean">English</label>
			
			<main lang="ja-JP">
					<p>問題が解決しない場合は管理者までお問い合わせください。以下のオプションを試すこともできます:</p>
					<ul>
							<li><a href="/cli">簡易クライアント</a>を起動</li>
							<li><a href="/bios">BIOS</a>で修復を試みる</li>
							<li><a href="/flush">キャッシュをクリア</a>する</li>
					</ul>
			</main>
			
			<main lang="ko-KR">
					<p>계속해서 문제가 해결되지 않는 경우 관리자에게 문의해 주십시오. 혹은 다음 방법을 시도하실 수 있습니다:</p>
					<ul>
							<li><a href="/cli">간이 클라이언트</a>를 실행</li>
							<li><a href="/bios">BIOS</a>에서 복구 시도</li>
							<li><a href="/flush">캐시 초기화</a></li>
					</ul>
			</main>
			
			<main lang="en">
					<p>If you have troubles on loading the web app, Please contact to the instance maintainer. Or you can try:</p>
					<ul>
							<li>Run <a href="/cli">Minimal Client</a></li>
							<li>Recover settings from <a href="/bios">BIOS</a></li>
							<li><a href="/flush">Flush local cache</a></li>
					</ul>
			</main>
			
			<hr>
			<code>ERROR CODE: ${code}</code>
			<details>
					${details}
			</details>
			
			<style>
					[lang] { display: none; }
					#ko-KR:checked ~ [lang~="ko-KR"] { display: block; }
					#ja-JP:checked ~ [lang~="ja-JP"] { display: block; }
					#en:checked ~ [lang~="en"] { display: block; }
			</style>
		`;
	}

	// eslint-disable-next-line no-inner-declarations
	async function checkUpdate() {
		// TODO: サーバーが落ちている場合などのエラーハンドリング
		const res = await fetch('/api/meta', {
			method: 'POST',
			cache: 'no-cache'
		});

		const meta = await res.json();

		if (meta.version != v) {
			localStorage.setItem('v', meta.version);
			refresh();
		}
	}

	// eslint-disable-next-line no-inner-declarations
	function refresh() {
		// Clear cache (service worker)
		try {
			navigator.serviceWorker.controller.postMessage('clear');
			navigator.serviceWorker.getRegistrations().then(registrations => {
				registrations.forEach(registration => registration.unregister());
			});
		} catch (e) {
			console.error(e);
		}

		location.reload();
	}
})();
