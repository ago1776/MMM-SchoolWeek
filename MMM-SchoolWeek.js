/* MagicMirror² Module: MMM-SchoolWeek
 * A weekly school timetable: five days side by side on a shared time axis.
 * The active day is shown in full (colour blocks with icon, subject and time, breaks as
 * real gaps); the other days are compact grey columns with subject abbreviations.
 *
 * By Andreas Göpfert — MIT Licensed.
 */
Module.register("MMM-SchoolWeek", {
	defaults: {
		title: "Timetable",
		schedule: [],                 // array of [dayNumber(1-5), "HHMM", "HHMM", "Subject"]
		weekdayLabels: ["", "Mon", "Tue", "Wed", "Thu", "Fri"],
		locale: null,                 // e.g. "en-GB" / "de-DE" for the active-day date (null = browser default)
		showActiveDate: true,         // append the date to the active weekday header
		gridHeight: 340,              // px height of the active-day time axis
		trimEdgeSubjects: [],         // subject names to drop when they are the first/last lesson of a day
		subjects: {},                 // optional overrides: { "Math": { color:"#c9781f", abbr:"Ma", icon:"<svg-inner>" } }
		updateInterval: 60 * 1000
	},

	getStyles() { return ["MMM-SchoolWeek.css"]; },

	start() { this.timer = setInterval(() => this.updateDom(), this.config.updateInterval); },

	// Built-in colour/icon/abbr map (fallback). Config `subjects` overrides by exact name.
	builtinMeta(key) {
		const I = {
			math: `<path d="M5 5h6M8 5v6M14 6l5 5M19 6l-5 5M5 18h6M5 15h6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>`,
			lang: `<path d="M6 4a2 2 0 0 1 2-2h11v18H8a2 2 0 0 0-2 2z" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M17 2v18" stroke="#fff" stroke-width="2"/>`,
			globe: `<circle cx="12" cy="12" r="9" stroke="#fff" stroke-width="2" fill="none"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke="#fff" stroke-width="1.6" fill="none"/>`,
			science: `<path d="M9 3h6M10 3v5l-4.5 8a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 8V3" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M8 16h8" stroke="#fff" stroke-width="2"/>`,
			music: `<path d="M9 18V6l10-2v11" stroke="#fff" stroke-width="2" fill="none"/><circle cx="6.5" cy="18" r="2.6" stroke="#fff" stroke-width="2" fill="none"/><circle cx="16.5" cy="15" r="2.6" stroke="#fff" stroke-width="2" fill="none"/>`,
			art: `<path d="M4 20l9-14 3 5-9 12z" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M13 6l3-3 3 3-3 3" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/>`,
			sport: `<path d="M3 15c2-2 3 1 5 0s3-2 5 0 3 1 5 0M3 19c2-2 3 1 5 0s3-2 5 0 3 1 5 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="9" cy="7" r="2" stroke="#fff" stroke-width="2" fill="none"/>`,
			generic: `<rect x="4" y="4" width="16" height="16" rx="2" stroke="#fff" stroke-width="2" fill="none"/>`
		};
		if (/math/.test(key)) return { icon: I.math, color: "#c9781f" };
		if (/(german|deutsch|english|franz|spanish|lang)/.test(key)) return { icon: I.lang, color: "#3f8f24" };
		if (/(geo|globe|welt|sach)/.test(key)) return { icon: I.science, color: "#9a8a18" };
		if (/(sci|physic|chem|bio)/.test(key)) return { icon: I.science, color: "#2f9d6e" };
		if (/music|musik/.test(key)) return { icon: I.music, color: "#b03434" };
		if (/(art|kunst|bk)/.test(key)) return { icon: I.art, color: "#a02fa0" };
		if (/(sport|pe|schwim|swim|gym)/.test(key)) return { icon: I.sport, color: "#2f9d9d" };
		return { icon: I.generic, color: "#3a4150" };
	},

	subjectMeta(nameRaw) {
		const name = (nameRaw || "").trim();
		const ov = this.config.subjects[name];
		const base = this.builtinMeta(name.toLowerCase());
		return {
			name,
			abbr: (ov && ov.abbr) || name.slice(0, 2),
			color: (ov && ov.color) || base.color,
			icon: (ov && ov.icon) || base.icon
		};
	},

	svg(inner, s) { return `<svg width="${s || 18}" height="${s || 18}" viewBox="0 0 24 24">${inner}</svg>`; },
	toMin(hhmm) { return parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(2), 10); },
	fmt(hhmm) { return hhmm.slice(0, 2) + ":" + hhmm.slice(2); },

	lessonsForDay(schedule, day) {
		const arr = schedule
			.filter((e) => e[0] === day && (e[3] || "").trim() !== "")
			.map((e) => ({ start: this.toMin(e[1]), end: this.toMin(e[2]), s: e[1], e: e[2], subject: e[3].trim() }))
			.sort((a, b) => a.start - b.start);
		const trim = (this.config.trimEdgeSubjects || []).map((x) => String(x).toLowerCase());
		const isTrim = (L) => trim.includes(L.subject.toLowerCase());
		while (arr.length && isTrim(arr[0])) arr.shift();
		while (arr.length && isTrim(arr[arr.length - 1])) arr.pop();
		return arr;
	},

	getDom() {
		const wrap = document.createElement("div");
		wrap.className = "sw-wrap";
		const sched = Array.isArray(this.config.schedule) ? this.config.schedule : [];
		const now = new Date();
		const jsDay = now.getDay();
		const todayNum = jsDay >= 1 && jsDay <= 5 ? jsDay : 0;
		const nowMin = now.getHours() * 60 + now.getMinutes();
		const short = this.config.weekdayLabels;

		const head = document.createElement("div");
		head.className = "sw-head";
		head.innerHTML = `<div class="sw-t">${this.config.title}</div>`;
		wrap.appendChild(head);
		const dateShort = now.toLocaleDateString(this.config.locale || undefined, { day: "2-digit", month: "2-digit" });

		const perDay = {};
		for (let d = 1; d <= 5; d++) perDay[d] = this.lessonsForDay(sched, d);
		// Scale the time axis to the active day only, so it fills the height cleanly.
		let tMin = Infinity, tMax = -Infinity;
		const scaleDays = (todayNum && perDay[todayNum] && perDay[todayNum].length) ? [todayNum] : [1, 2, 3, 4, 5];
		for (const d of scaleDays) perDay[d].forEach((L) => { tMin = Math.min(tMin, L.start); tMax = Math.max(tMax, L.end); });
		if (!isFinite(tMin)) { return wrap; }
		const span = Math.max(1, tMax - tMin);
		const H = this.config.gridHeight;
		const y = (min) => ((min - tMin) / span) * H;

		const grid = document.createElement("div");
		grid.className = "sw-grid";
		grid.style.height = `${H}px`;
		for (let d = 1; d <= 5; d++) {
			const active = d === todayNum;
			const col = document.createElement("div");
			col.className = "sw-col" + (active ? " sw-active" : " sw-dim");
			const dayLabel = active && this.config.showActiveDate ? `${short[d]} · ${dateShort}` : short[d];
			let inner = `<div class="sw-day">${dayLabel}</div>`;
			if (active) {
				const lane = [];
				perDay[d].forEach((L) => {
					const m = this.subjectMeta(L.subject);
					const top = y(L.start), h = Math.max(30, y(L.end) - y(L.start) - 3);
					const running = jsDay === d && nowMin >= L.start && nowMin < L.end;
					const compact = h < 40;
					lane.push(`<div class="sw-blk${running ? " sw-now" : ""}${compact ? " sw-cmp" : ""}" style="top:${top.toFixed(1)}px;height:${h.toFixed(1)}px;background:${m.color}">
						<span class="sw-ic">${this.svg(m.icon, 19)}</span>
						<span class="sw-nm">${m.name}</span>
						<span class="sw-tm">${this.fmt(L.s)}–${this.fmt(L.e)}</span>
					</div>`);
				});
				inner += `<div class="sw-lane" style="height:${H}px">${lane.join("")}</div>`;
			} else {
				const cells = perDay[d].map((L) => {
					const m = this.subjectMeta(L.subject);
					return `<div class="sw-ab"><i style="background:${m.color}"></i><span>${m.abbr}</span></div>`;
				}).join("");
				inner += `<div class="sw-lane sw-evenly" style="height:${H}px">${cells}</div>`;
			}
			col.innerHTML = inner;
			grid.appendChild(col);
		}
		wrap.appendChild(grid);
		return wrap;
	}
});
