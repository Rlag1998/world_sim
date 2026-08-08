// ui.js — DOM chrome around the canvas: topbar, chronicle panel, colonist roster,
// detail drawer, alerts, memorial. All read-only: the viewer watches; the world decides.

const UIx = {
  init() {
    this.$ = (id) => document.getElementById(id);
    this.chronList = this.$('chronicle-list');
    this.roster = this.$('roster');
    this.detail = this.$('detail');
    this.alerts = this.$('alerts');
    this.lastChronIx = 0;
    this.lastRosterKey = '';
    this.portraits = new Map();
    this.majorOnly = false;
    this.pinned = true;
    this.$('chron-filter').addEventListener('click', () => {
      this.majorOnly = !this.majorOnly;
      this.sagaMode = false;
      this.$('chron-saga').classList.remove('on');
      this.$('chron-filter').classList.toggle('on', this.majorOnly);
      this.rebuildChronicle(W);
    });
    this.$('chron-saga').addEventListener('click', () => {
      this.sagaMode = !this.sagaMode;
      this.$('chron-saga').classList.toggle('on', this.sagaMode);
      if (this.sagaMode) this.renderSaga(W);
      else this.rebuildChronicle(W);
    });
    this.chronList.addEventListener('scroll', () => {
      const el = this.chronList;
      this.pinned = el.scrollTop + el.clientHeight > el.scrollHeight - 60;
    });
    this.$('detail-close').addEventListener('click', () => { Renderer.selectedId = null; this.renderDetail(W); });
  },

  tick(world) {
    this.renderTop(world);
    this.appendChronicle(world);
    this.renderAlerts(world);
    if (performance.now() - (this._rosterAt || 0) > 600) {
      this.renderRoster(world);
      this.renderDetail(world);
      this._rosterAt = performance.now();
    }
    this.renderMemorial(world);
  },

  renderTop(world) {
    this.$('colony-name').textContent = world.colonyName;
    this.$('date').textContent = Chron.dateStr(world);
    const weatherIcon = world.weather === 'storm' ? '⛈️' : world.weather === 'rain' ? (world.tempOut < 1 ? '🌨️' : '🌧️') : world.isNight ? '🌙' : '☀️';
    this.$('weather').textContent = `${weatherIcon} ${Math.round(world.tempOut)}°C`;
    this.$('season-chip').textContent = `${world.season}, year ${world.year0 + 1}`;
    const colonists = world.pawns.filter(p => p.isColonist());
    this.$('pop').textContent = `👥 ${colonists.length}`;
    this.$('wealth').textContent = `⌾ ${Sim.colonyWealth(world)}`;
    this.$('storyteller-chip').textContent = `📖 ${PERSONAS[world.st.persona].n}`;
    this.$('threat-chip').style.display = world.threat ? '' : 'none';
  },

  entryHtml(e) {
    if (e.chapter) {
      return `<div class="chron-chapter"><span>Chapter ${e.chapterNum}</span>${e.text}</div>`;
    }
    const cls = e.tone === 'chapter' ? '' : e.tone;
    return `<div class="chron-entry ${cls} ${e.major ? 'major' : ''}">
      <div class="chron-date">${e.date}</div>
      <div class="chron-text">${e.icon ? `<span class="ico">${e.icon}</span>` : ''}${e.text}</div>
    </div>`;
  },

  // "The saga so far" — the memory bank as a condensed legend of this colony
  renderSaga(world) {
    const mems = world.chron.memories;
    let html = `<div class="chron-chapter"><span>the saga so far</span>${world.colonyName}</div>`;
    if (!mems.length) html += `<div class="chron-entry"><div class="chron-text">Nothing legendary yet. Give them time — or trouble.</div></div>`;
    for (const m of mems) {
      html += `<div class="chron-entry major"><div class="chron-date">day ${m.day}</div><div class="chron-text">${U.cap(m.text)}.</div></div>`;
    }
    this.chronList.innerHTML = html;
    this.chronList.scrollTop = this.chronList.scrollHeight;
  },

  appendChronicle(world) {
    if (this.sagaMode) return;
    const entries = world.chron.entries;
    if (this.lastChronIx > entries.length) { this.rebuildChronicle(world); return; }
    let html = '';
    for (let i = this.lastChronIx; i < entries.length; i++) {
      const e = entries[i];
      if (this.majorOnly && !e.major && !e.chapter) continue;
      html += this.entryHtml(e);
    }
    this.lastChronIx = entries.length;
    if (html) {
      this.chronList.insertAdjacentHTML('beforeend', html);
      while (this.chronList.children.length > 450) this.chronList.removeChild(this.chronList.firstChild);
      if (this.pinned) this.chronList.scrollTop = this.chronList.scrollHeight;
    }
  },

  rebuildChronicle(world) {
    let html = '';
    for (const e of world.chron.entries) {
      if (this.majorOnly && !e.major && !e.chapter) continue;
      html += this.entryHtml(e);
    }
    this.chronList.innerHTML = html;
    this.lastChronIx = world.chron.entries.length;
    this.chronList.scrollTop = this.chronList.scrollHeight;
  },

  renderAlerts(world) {
    const recent = world.chron.entries.slice(-14).filter(e => e.major && e.tone === 'bad' && world.t - e.t < 700);
    const html = recent.slice(-3).map(e => `<div class="alert">${e.icon} ${e.text.length > 90 ? e.text.slice(0, 90) + '…' : e.text}</div>`).join('');
    if (html !== this._alertsHtml) { this.alerts.innerHTML = html; this._alertsHtml = html; }
  },

  moodColor(p) {
    const m = p.mood;
    if (m < p.breakThreshold('minor')) return '#e0684f';
    if (m < 45) return '#dfa53f';
    if (m < 65) return '#c9c56a';
    return '#7fbf6a';
  },

  jobLabel(world, p) {
    if (p.dead) return 'dead';
    if (p.downed) return '⚕ down';
    if (p.breaking) return '💥 ' + { wander: 'dazed', binge: 'binging', hide: 'hiding away', tantrum: 'tantrum!', berserk: 'BERSERK', fire: 'starting fires!', leave: 'leaving...' }[p.breaking.kind];
    if (p.mode === 'fight') return '⚔ fighting';
    if (p.mode === 'hide') return '🫣 sheltering';
    if (!p.job) return 'idle';
    const map = {
      sleep: '💤 sleeping', eat: '🍲 eating', patient: '🛏 resting', harvest: '🌾 harvesting', sow: '🌱 sowing',
      chop: '🪓 chopping', mine: '⛏ mining', build: '🔨 building', haul: '📦 hauling', cook: '🍳 cooking',
      hunt: '🏹 hunting', tend: '🩹 tending', research: '📖 researching', craft: '🛠 crafting', clean: '🧹 cleaning',
      bury: '🪦 burying', rescue: '🚑 rescuing', capture: '⛓ capturing', attend: '🎪 gathering', butcher: '🔪 butchering',
      joyAt: '🎯 relaxing', joyWalk: '🚶 strolling', stargaze: '🌌 stargazing', playPet: '🐕 playing', visitGrave: '🪦 visiting',
      firefight: '🧯 firefighting', recruitChat: '🗣 recruiting', deliverPrisonerFood: '🍲 warden rounds',
      forage: '🫐 foraging', feedBaby: '🍼 feeding', wander: '… wandering', dumpCorpse: '🧺 clearing',
    };
    return map[p.job.type] || p.job.type;
  },

  renderRoster(world) {
    const colonists = world.pawns.filter(p => p.isColonist());
    const prisoners = world.pawns.filter(p => p.prisoner && !p.dead);
    const key = colonists.map(p => p.id).join(',') + '|' + prisoners.map(p => p.id).join(',');
    if (key !== this.lastRosterKey) {
      this.lastRosterKey = key;
      this.roster.innerHTML = '';
      const addCard = (p, cls) => {
        const card = document.createElement('div');
        card.className = 'pawn-card ' + (cls || '');
        card.dataset.pid = p.id;
        const cv = document.createElement('canvas');
        cv.width = 44; cv.height = 44; cv.className = 'portrait';
        card.appendChild(cv);
        const info = document.createElement('div');
        info.className = 'pawn-info';
        info.innerHTML = `<div class="pawn-name"></div><div class="pawn-task"></div><div class="mood-bar"><div class="mood-fill"></div></div>`;
        card.appendChild(info);
        card.addEventListener('click', () => {
          Renderer.selectedId = p.id;
          Renderer.followId = (Renderer.followId === p.id) ? null : null;
          this.renderDetail(world);
        });
        card.addEventListener('dblclick', () => { Renderer.followId = p.id; });
        this.roster.appendChild(card);
        this.portraits.set(p.id, cv);
        Renderer.paintPortrait(cv, p);
      };
      for (const p of colonists) addCard(p);
      for (const p of prisoners) addCard(p, 'prisoner');
    }
    for (const card of this.roster.children) {
      const p = world.byId[+card.dataset.pid];
      if (!p) continue;
      card.querySelector('.pawn-name').textContent = p.label() + (p.prisoner ? ' (prisoner)' : '');
      card.querySelector('.pawn-task').textContent = this.jobLabel(world, p);
      const fill = card.querySelector('.mood-fill');
      fill.style.width = p.mood + '%';
      fill.style.background = this.moodColor(p);
      card.classList.toggle('downed', p.downed);
      card.classList.toggle('selected', Renderer.selectedId === p.id);
    }
  },

  renderDetail(world) {
    const p = Renderer.selectedId ? world.byId[Renderer.selectedId] : null;
    const panel = this.$('detail-wrap');
    if (!p || p.thing !== 'pawn') { panel.style.display = 'none'; return; }
    panel.style.display = '';
    const rel = (id) => { const q = world.byId[id]; return q ? q.label() : '?'; };
    const age = p.ageYears(world);
    let html = `<div class="d-head"><b>${p.full()}</b><span>${age}, ${p.gender === 'm' ? 'he/him' : p.gender === 'f' ? 'she/her' : 'they/them'}</span></div>`;
    html += `<div class="d-back">${p.childhood.n}${p.adulthood ? ' → ' + p.adulthood.n : ''}. ${U.cap(p.he)} ${p.childhood.d.replace('{colony}', world.colonyName)}${p.adulthood ? `; later ${p.he} ${p.adulthood.d}.` : '.'}</div>`;
    html += `<div class="d-traits">${p.traits.map(t => `<span class="chip" title="${TRAITS[t].d}">${TRAITS[t].n}</span>`).join('')}</div>`;
    html += `<div class="d-sec">Mood ${p.mood}/100 · Food ${Math.round(p.needs.food * 100)}% · Rest ${Math.round(p.needs.rest * 100)}%</div>`;
    // thoughts
    const tcount = {};
    for (const t of p.thoughts) {
      const def = THOUGHTS[t.k];
      const label = def ? def.l : t.k;
      tcount[label] = (tcount[label] || { n: 0, m: 0 });
      tcount[label].n++; tcount[label].m += t.m;
    }
    const thoughtRows = Object.entries(tcount).map(([l, v]) => `<div class="thought"><span>${l}${v.n > 1 ? ' ×' + v.n : ''}</span><span class="${v.m >= 0 ? 'pos' : 'neg'}">${U.sgn(Math.round(v.m))}</span></div>`).join('');
    html += `<div class="d-sec-title">Thoughts</div>${thoughtRows || '<div class="thought muted">nothing in particular</div>'}`;
    // health
    const injuries = p.injuries.map(i => `<div class="thought"><span>${i.kind} (${PART_LABEL[i.part]})</span><span class="${i.tended ? 'pos' : 'neg'}">${i.tended ? 'tended' : i.bleed > 0 ? 'bleeding' : 'raw'}</span></div>`).join('');
    const diseases = p.diseases.map(d => `<div class="thought"><span>${d.kind}</span><span class="neg">${Math.round(d.sev * 100)}% vs ${Math.round(d.imm * 100)}%</span></div>`).join('');
    const lost = p.lostParts.map(k => `<div class="thought"><span>missing ${PART_LABEL[k]}</span><span class="neg">–</span></div>`).join('');
    if (injuries || diseases || lost || p.blood < 0.98) {
      html += `<div class="d-sec-title">Health · blood ${Math.round(p.blood * 100)}%</div>${lost}${injuries}${diseases}`;
    }
    // relations
    const rels = [];
    if (p.spouseId) rels.push(`💍 ${rel(p.spouseId)}`);
    else if (p.loverId) rels.push(`❤️ ${rel(p.loverId)}`);
    if (p.family.mo && world.byId[p.family.mo]) rels.push(`mother: ${rel(p.family.mo)}`);
    if (p.family.fa && world.byId[p.family.fa]) rels.push(`father: ${rel(p.family.fa)}`);
    for (const k of p.family.kids) if (world.byId[k]) rels.push(`child: ${rel(k)}`);
    const others = world.pawns.filter(q => q.isColonist() && q !== p).map(q => ({ q, op: Social.opinion(p, q) }))
      .filter(o => Math.abs(o.op) >= 22).sort((a, b) => b.op - a.op).slice(0, 4);
    for (const o of others) rels.push(`${o.op > 0 ? '🤝' : '⚡'} ${o.q.label()} (${U.sgn(o.op)})`);
    if (rels.length) html += `<div class="d-sec-title">Bonds</div><div class="d-back">${rels.join(' · ')}</div>`;
    // skills
    html += `<div class="d-sec-title">Skills</div><div class="skills">` + SKILLS.map(s => {
      const sk = p.skills[s];
      if (!sk || sk.lv === 0) return '';
      return `<span class="skill">${s} <b>${sk.lv}</b>${'🔥'.repeat(sk.pas)}</span>`;
    }).join('') + `</div>`;
    // life story
    if (p.story.length) {
      html += `<div class="d-sec-title">Life story</div>` + p.story.slice(-8).reverse().map(s2 => `<div class="story-line">· ${s2.text} <span class="muted">(day ${s2.day})</span></div>`).join('');
    }
    this.detail.innerHTML = html;
  },

  renderMemorial(world) {
    const el = this.$('memorial');
    if (!world.gameOverState) { el.style.display = 'none'; return; }
    if (el.style.display !== 'flex') {
      el.style.display = 'flex';
      const graves = world.buildings.filter(b => !b.blueprint && BUILDINGS[b.key].grave && b.meta && b.meta.occupant);
      const memories = world.chron.memories.slice(-12).map(m => `<div class="mem-line">· ${m.text}</div>`).join('');
      this.$('memorial-body').innerHTML = `
        <h1>The Chronicle of ${world.colonyName}</h1>
        <p class="mem-sub">${world.day} days · ${world.year0 + 1}${world.year0 ? ' years' : 'st year'} · ${world.stats.raidsSurvived} raids survived · ${graves.length} graves</p>
        <div class="mem-list">${memories || '<div class="mem-line">A short story, but theirs.</div>'}</div>
        <p class="mem-sub">A new chronicle begins shortly…</p>`;
      // fresh story after a slow, respectful pause
      setTimeout(() => { Main.newChronicle(); }, 30000);
    }
  },
};

Object.assign(globalThis, { UIx });
