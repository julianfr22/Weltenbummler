/* =====================================================================
   WELTENBUMMLER – Spielregeln (Engine)
   Diese Datei läuft an zwei Orten mit demselben Code:
     · auf dem Spiel-Server (src/worker.js) – der Server ist die Wahrheit
     · im Browser (Solo-Modus gegen Bots, funktioniert auch offline)
   Alle Stellschrauben (Preise, Start-Coins …) stehen in CFG ganz oben.
   ===================================================================== */
(function (root) {
"use strict";

/* ---------- Stellschrauben ---------- */
const CFG = {
  START_COINS: 15,      // T-Coins zu Spielbeginn
  START_LIVES: 3,       // Leben zu Spielbeginn (und nach einem K.O.)
  MAX_LIVES: 5,
  COIN_FIELD: 4,        // T-Coins auf einem Münzfeld
  OWN_BONUS: 2,         // T-Coins, wenn man auf dem eigenen Zollfeld landet
  CASE_PRICE: 50,       // Koffer öffnen
  CASE_DISC: 30,        // … mit Koffer-Gutschein
  FLY_PRICE: 8,         // Flug zwischen zwei Flughäfen
  PROP_PRICE: 8,        // Zollfeld beanspruchen
  TOLL: 4,              // Zoll in T-Coins
  MAX_ITEMS: 3,
  MAX_PLAYERS: 8,
  MINI_COINS: [12, 8, 5, 3, 2, 2, 2, 2],   // T-Coins nach Platzierung im Minispiel
  AFK_MS: 45000,        // so lange darf ein Mensch überlegen, dann zieht das Spiel für ihn
  AFK_AGAIN_MS: 12000,  // … danach nur noch so lange, bis er wieder selbst etwas tut
  BOT_MS: 1100,
  MINI_INTRO_MS: 4500,
};

/* ---------- Spielbrett (aus der Landkarte ausgelesen) ----------
   nodes[i] = { x, y (Pixel auf der Karte 1774×887), t: Feldtyp, c: Kontinent,
                n: [Felder, zu denen man von hier weiterlaufen darf],
                air: Flughafen-Name, lm: Sehenswürdigkeit }
   Feldtypen: coin · life · item · luck · prop (Zollfeld) · air · sea        */
const BOARD = {"w":1774,"h":887,"nodes":[{"x":949.1,"y":95.4,"t":"coin","c":"EU","n":[7]},{"x":890.8,"y":108.2,"t":"prop","c":"EU","n":[0]},{"x":1217.8,"y":114.9,"t":"prop","c":"AS","n":[4]},{"x":1333.1,"y":117.0,"t":"coin","c":"AS","n":[2]},{"x":1107.9,"y":122.7,"t":"luck","c":"EU","n":[12]},{"x":692.5,"y":125.8,"t":"item","c":"EU","n":[6,11]},{"x":574.4,"y":131.9,"t":"prop","c":"NA","n":[20,5]},{"x":1007.1,"y":140.3,"t":"coin","c":"EU","n":[12]},{"x":1424.6,"y":144.6,"t":"item","c":"AS","n":[3]},{"x":880.3,"y":150.5,"t":"luck","c":"EU","n":[1]},{"x":215.3,"y":161.2,"t":"coin","c":"NA","n":[14]},{"x":762.6,"y":163.6,"t":"coin","c":"EU","n":[17,5]},{"x":1041.4,"y":170.6,"t":"luck","c":"EU","n":[23]},{"x":134.8,"y":175.4,"t":"luck","c":"NA","n":[19]},{"x":180.3,"y":165.1,"t":"coin","c":"NA","n":[13]},{"x":258.0,"y":166.9,"t":"prop","c":"NA","n":[10]},{"x":1503.7,"y":178.1,"t":"prop","c":"AS","n":[8]},{"x":783.9,"y":188.9,"t":"life","c":"EU","n":[26,11],"lm":"Big Ben"},{"x":281.5,"y":191.7,"t":"item","c":"NA","n":[15]},{"x":211.2,"y":195.0,"t":"coin","c":"NA","n":[29]},{"x":483.0,"y":195.0,"t":"coin","c":"NA","n":[21,6]},{"x":435.0,"y":200.0,"t":"life","c":"NA","n":[24]},{"x":910.0,"y":200.7,"t":"prop","c":"EU","n":[142]},{"x":1107.5,"y":208.9,"t":"prop","c":"EU","n":[33,34]},{"x":388.9,"y":210.0,"t":"luck","c":"NA","n":[25]},{"x":340.1,"y":212.9,"t":"luck","c":"NA","n":[28]},{"x":815.5,"y":212.9,"t":"prop","c":"EU","n":[142,17,31],"lm":"Eiffelturm"},{"x":1555.2,"y":221.4,"t":"life","c":"AS","n":[16]},{"x":311.1,"y":224.4,"t":"life","c":"NA","n":[18,41]},{"x":193.5,"y":229.6,"t":"coin","c":"NA","n":[44]},{"x":452.9,"y":235.6,"t":"coin","c":"NA","n":[20],"lm":"Freiheitsstatue"},{"x":794.7,"y":237.4,"t":"coin","c":"EU","n":[26,42]},{"x":900.1,"y":241.1,"t":"item","c":"EU","n":[22],"lm":"Kolosseum"},{"x":1056.7,"y":238.6,"t":"coin","c":"EU","n":[43]},{"x":1156.0,"y":240.2,"t":"item","c":"AS","n":[40]},{"x":1311.6,"y":244.9,"t":"coin","c":"AS","n":[36],"lm":"Himalaya"},{"x":1363.5,"y":250.6,"t":"coin","c":"AS","n":[45]},{"x":947.5,"y":258.6,"t":"coin","c":"EU","n":[32]},{"x":1588.0,"y":258.8,"t":"prop","c":"AS","n":[27]},{"x":1269.8,"y":263.2,"t":"coin","c":"AS","n":[35]},{"x":1217.7,"y":266.2,"t":"coin","c":"AS","n":[39]},{"x":312.1,"y":269.0,"t":"coin","c":"NA","n":[28,47]},{"x":753.6,"y":269.5,"t":"life","c":"EU","n":[31,51,152]},{"x":1004.1,"y":275.8,"t":"coin","c":"EU","n":[37]},{"x":192.4,"y":277.9,"t":"coin","c":"NA","n":[50],"lm":"Golden Gate Bridge"},{"x":1353.6,"y":293.3,"t":"coin","c":"AS","n":[57]},{"x":1060.4,"y":298.1,"t":"item","c":"AS","n":[43]},{"x":308.3,"y":303.5,"t":"item","c":"NA","n":[48,41]},{"x":346.0,"y":302.5,"t":"coin","c":"NA","n":[59]},{"x":380.6,"y":301.8,"t":"coin","c":"NA","n":[143]},{"x":213.9,"y":312.9,"t":"prop","c":"NA","n":[63]},{"x":744.6,"y":313.4,"t":"coin","c":"AF","n":[42,62]},{"x":1088.9,"y":315.2,"t":"coin","c":"AS","n":[46,64]},{"x":1127.5,"y":314.5,"t":"coin","c":"AS","n":[52]},{"x":270.7,"y":326.9,"t":"prop","c":"NA","n":[47]},{"x":1168.3,"y":327.8,"t":"prop","c":"AS","n":[53]},{"x":1002.6,"y":328.7,"t":"luck","c":"AS","n":[68,67]},{"x":1333.5,"y":327.7,"t":"coin","c":"AS","n":[65]},{"x":795.0,"y":339.1,"t":"coin","c":"AF","n":[51]},{"x":365.3,"y":342.3,"t":"coin","c":"NA","n":[49]},{"x":1520.3,"y":342.2,"t":"luck","c":"AS","n":[144,77],"lm":"Torii-Tor"},{"x":1225.5,"y":347.9,"t":"coin","c":"AS","n":[55]},{"x":723.6,"y":348.8,"t":"prop","c":"AF","n":[71]},{"x":237.0,"y":356.4,"t":"prop","c":"NA","n":[54,74]},{"x":1095.0,"y":352.4,"t":"item","c":"AS","n":[145,52]},{"x":1331.8,"y":363.6,"t":"prop","c":"AS","n":[70,69]},{"x":848.4,"y":364.5,"t":"coin","c":"AF","n":[58]},{"x":1038.0,"y":365.8,"t":"luck","c":"AS","n":[76]},{"x":992.8,"y":365.2,"t":"coin","c":"AF","n":[79,56]},{"x":1378.8,"y":367.0,"t":"luck","c":"AS","n":[72]},{"x":1284.9,"y":365.4,"t":"luck","c":"AS","n":[61,81]},{"x":703.2,"y":380.6,"t":"coin","c":"AF","n":[80,154]},{"x":1412.5,"y":383.4,"t":"prop","c":"AS","n":[60]},{"x":1114.5,"y":385.2,"t":"life","c":"AS","n":[145]},{"x":274.0,"y":389.9,"t":"coin","c":"NA","n":[63,78]},{"x":938.7,"y":386.7,"t":"prop","c":"AF","n":[66],"lm":"Pyramiden"},{"x":1084.4,"y":397.1,"t":"prop","c":"AS","n":[73]},{"x":1563.0,"y":402.0,"t":"coin","c":"AS","n":[88]},{"x":320.2,"y":407.5,"t":"coin","c":"NA","n":[74,87]},{"x":1014.2,"y":408.1,"t":"item","c":"AF","n":[75,68]},{"x":715.5,"y":415.3,"t":"coin","c":"AF","n":[83]},{"x":1282.2,"y":416.2,"t":"luck","c":"AS","n":[70,92]},{"x":1410.1,"y":428.2,"t":"life","c":"AS","n":[72]},{"x":765.3,"y":432.3,"t":"luck","c":"AF","n":[86]},{"x":398.1,"y":434.0,"t":"coin","c":"SA","n":[87]},{"x":445.7,"y":440.0,"t":"coin","c":"SA","n":[84]},{"x":821.1,"y":439.6,"t":"coin","c":"AF","n":[91]},{"x":361.9,"y":440.6,"t":"coin","c":"SA","n":[78,96]},{"x":1580.8,"y":441.3,"t":"prop","c":"AS","n":[97]},{"x":1096.4,"y":454.8,"t":"coin","c":"AF","n":[79]},{"x":484.9,"y":459.0,"t":"coin","c":"SA","n":[85]},{"x":863.0,"y":465.7,"t":"prop","c":"AF","n":[102]},{"x":1253.5,"y":466.1,"t":"coin","c":"AS","n":[81,155,159]},{"x":1438.6,"y":471.8,"t":"coin","c":"AS","n":[82]},{"x":517.8,"y":481.4,"t":"coin","c":"SA","n":[90],"lm":"Christusstatue"},{"x":1050.8,"y":485.3,"t":"coin","c":"AF","n":[89]},{"x":346.2,"y":485.4,"t":"item","c":"SA","n":[105]},{"x":1598.1,"y":490.1,"t":"coin","c":"OZ","n":[104]},{"x":569.0,"y":494.4,"t":"life","c":"SA","n":[94,99,153]},{"x":514.1,"y":513.5,"t":"coin","c":"SA","n":[98,107]},{"x":592.9,"y":514.1,"t":"coin","c":"SA","n":[98]},{"x":1449.3,"y":509.2,"t":"prop","c":"OZ","n":[93,158]},{"x":882.9,"y":518.6,"t":"coin","c":"AF","n":[111]},{"x":1037.5,"y":523.5,"t":"prop","c":"AF","n":[95]},{"x":1654.5,"y":526.8,"t":"coin","c":"OZ","n":[116]},{"x":356.0,"y":531.4,"t":"luck","c":"SA","n":[110]},{"x":1499.2,"y":533.4,"t":"prop","c":"OZ","n":[101]},{"x":474.2,"y":540.3,"t":"prop","c":"SA","n":[99,109],"lm":"Maya-Tempel"},{"x":584.4,"y":554.8,"t":"life","c":"SA","n":[100]},{"x":450.0,"y":561.4,"t":"coin","c":"SA","n":[107,110]},{"x":399.9,"y":571.0,"t":"luck","c":"SA","n":[117,109]},{"x":891.5,"y":571.4,"t":"luck","c":"AF","n":[118]},{"x":1111.7,"y":576.0,"t":"item","c":"AF","n":[119,161]},{"x":1548.0,"y":586.9,"t":"luck","c":"OZ","n":[116,106]},{"x":563.6,"y":594.3,"t":"coin","c":"SA","n":[108]},{"x":1001.6,"y":598.7,"t":"life","c":"AF","n":[103,162]},{"x":1656.5,"y":601.1,"t":"luck","c":"OZ","n":[122]},{"x":408.6,"y":616.0,"t":"luck","c":"SA","n":[125]},{"x":903.0,"y":615.8,"t":"coin","c":"AF","n":[146]},{"x":1092.2,"y":620.7,"t":"luck","c":"AF","n":[112,162]},{"x":527.4,"y":620.9,"t":"coin","c":"SA","n":[114]},{"x":1561.4,"y":632.1,"t":"coin","c":"OZ","n":[113],"lm":"Uluru"},{"x":1678.0,"y":640.2,"t":"coin","c":"OZ","n":[148],"lm":"Opernhaus"},{"x":972.6,"y":634.7,"t":"life","c":"AF","n":[115]},{"x":1564.3,"y":666.6,"t":"coin","c":"OZ","n":[121]},{"x":401.0,"y":673.8,"t":"coin","c":"SA","n":[128]},{"x":471.0,"y":686.6,"t":"prop","c":"SA","n":[147]},{"x":1601.0,"y":706.2,"t":"prop","c":"OZ","n":[124]},{"x":400.0,"y":718.1,"t":"item","c":"SA","n":[131]},{"x":438.5,"y":717.4,"t":"prop","c":"SA","n":[126]},{"x":1647.8,"y":725.8,"t":"prop","c":"OZ","n":[127,132]},{"x":415.8,"y":768.8,"t":"coin","c":"SA","n":[129,135]},{"x":1601.7,"y":776.4,"t":"coin","c":"OZ","n":[130,165]},{"x":992.2,"y":808.2,"t":"coin","c":"AN","n":[138,134]},{"x":1119.0,"y":812.0,"t":"coin","c":"AN","n":[133,137]},{"x":438.3,"y":817.7,"t":"prop","c":"SA","n":[131,169]},{"x":1321.1,"y":815.6,"t":"prop","c":"AN","n":[137,168]},{"x":1232.0,"y":820.1,"t":"coin","c":"AN","n":[134,136]},{"x":869.5,"y":825.2,"t":"coin","c":"AN","n":[139,133,164]},{"x":755.0,"y":845.8,"t":"coin","c":"AN","n":[141,138],"lm":"Südpol"},{"x":531.1,"y":858.3,"t":"prop","c":"AN","n":[141,169]},{"x":648.7,"y":859.8,"t":"coin","c":"AN","n":[140,139]},{"x":855.0,"y":208.0,"t":"air","c":"EU","n":[9,26],"air":"Köln","lm":"Kölner Dom"},{"x":419.0,"y":267.0,"t":"air","c":"NA","n":[30,149],"air":"New York"},{"x":1556.0,"y":300.5,"t":"air","c":"AS","n":[38],"air":"Tokio"},{"x":1136.5,"y":369.0,"t":"air","c":"AS","n":[64],"air":"Dubai"},{"x":927.0,"y":654.0,"t":"air","c":"AF","n":[123,163],"air":"Kapstadt"},{"x":494.0,"y":664.0,"t":"air","c":"SA","n":[120],"air":"Buenos Aires"},{"x":1686.0,"y":690.0,"t":"air","c":"OZ","n":[130],"air":"Sydney"},{"x":485.7,"y":283.6,"t":"sea","c":"SEA","n":[143,150]},{"x":552.5,"y":292.0,"t":"sea","c":"SEA","n":[149,151]},{"x":620.3,"y":289.8,"t":"sea","c":"SEA","n":[150,152]},{"x":686.1,"y":283.5,"t":"sea","c":"SEA","n":[151,42]},{"x":591.8,"y":430.8,"t":"sea","c":"SEA","n":[98,154]},{"x":633.1,"y":390.5,"t":"sea","c":"SEA","n":[153,71]},{"x":1287.7,"y":497.6,"t":"sea","c":"SEA","n":[92,156]},{"x":1323.9,"y":518.5,"t":"sea","c":"SEA","n":[155,157]},{"x":1364.4,"y":520.4,"t":"sea","c":"SEA","n":[156,158]},{"x":1406.7,"y":516.0,"t":"sea","c":"SEA","n":[157,101]},{"x":1242.1,"y":524.6,"t":"sea","c":"SEA","n":[92,160]},{"x":1204.4,"y":549.0,"t":"sea","c":"SEA","n":[159,161]},{"x":1160.8,"y":566.1,"t":"sea","c":"SEA","n":[160,112]},{"x":1046.1,"y":613.0,"t":"sea","c":"SEA","n":[115,119]},{"x":920.0,"y":715.1,"t":"sea","c":"SEA","n":[146,164]},{"x":894.0,"y":769.9,"t":"sea","c":"SEA","n":[163,138]},{"x":1543.0,"y":766.3,"t":"sea","c":"SEA","n":[132,166]},{"x":1486.2,"y":769.1,"t":"sea","c":"SEA","n":[165,167]},{"x":1430.4,"y":779.2,"t":"sea","c":"SEA","n":[166,168]},{"x":1375.3,"y":793.8,"t":"sea","c":"SEA","n":[167,136]},{"x":485.5,"y":835.9,"t":"sea","c":"SEA","n":[135,140]}],"start":142};
const N = BOARD.nodes;

const CONTS = {
  NA: { name: "Nordamerika", icon: "🗽", color: "#E76F51" },
  SA: { name: "Südamerika",  icon: "🦜", color: "#2A9D8F" },
  EU: { name: "Europa",      icon: "🏰", color: "#264653" },
  AF: { name: "Afrika",      icon: "🦁", color: "#F4A261" },
  AS: { name: "Asien",       icon: "🐉", color: "#C8553D" },
  OZ: { name: "Ozeanien",    icon: "🦘", color: "#8E6FB0" },
  AN: { name: "Antarktis",   icon: "🐧", color: "#4A90B8" },
};
const CONT_KEYS = Object.keys(CONTS);

const ITEMS = {
  double:  { name: "Doppelwürfel",     icon: "🎲", good: true,  text: "Würfle mit zwei Würfeln." },
  gold:    { name: "Wunschwürfel",     icon: "✨", good: true,  text: "Such dir deine Augenzahl (1–6) aus.", pick: "value" },
  ticket:  { name: "Freiflug-Ticket",  icon: "🎫", good: true,  text: "Fliege gratis zu einem Flughafen deiner Wahl – danach würfelst du normal.", pick: "airport" },
  thief:   { name: "Langfinger",       icon: "🧤", good: true,  text: "Klaue einem Mitspieler bis zu 8 T-Coins.", pick: "player" },
  glove:   { name: "Boxhandschuh",     icon: "🥊", good: true,  text: "Ein Mitspieler verliert 1 Leben.", pick: "player" },
  voucher: { name: "Koffer-Gutschein", icon: "🏷️", good: true,  text: "Dein nächster Koffer kostet nur 30 statt 50 T-Coins." },
  mini:    { name: "Mini-Würfel",      icon: "🔹", good: false, text: "Würfle nur 1–3 – gut zum genauen Landen." },
  plaster: { name: "Pflaster",         icon: "🩹", good: false, text: "+1 Leben." },
  piggy:   { name: "Sparschwein",      icon: "🐷", good: false, text: "+4 T-Coins." },
  snail:   { name: "Schneckenschleim", icon: "🐌", good: false, text: "Der nächste Wurf eines Mitspielers wird halbiert.", pick: "player" },
};
const GOOD_ITEMS = Object.keys(ITEMS).filter((k) => ITEMS[k].good);
const WEAK_ITEMS = Object.keys(ITEMS).filter((k) => !ITEMS[k].good);

/* Glückskarten */
const CARDS = [
  { id: "lotto",  title: "Lottogewinn!",        text: "Du bekommst 10 T-Coins." },
  { id: "found",  title: "Fundsache",           text: "Am Strand liegt ein Geldbeutel: +5 T-Coins." },
  { id: "tourist",title: "Souvenir-Abzocke",    text: "Der Magnet war teuer: −5 T-Coins." },
  { id: "payall", title: "Runde ausgeben",      text: "Du zahlst jedem Mitspieler 3 T-Coins." },
  { id: "getall", title: "Reisegeburtstag",     text: "Jeder Mitspieler schenkt dir 3 T-Coins." },
  { id: "tp",     title: "Spontantrip",         text: "" },
  { id: "tp",     title: "Spontantrip",         text: "" },
  { id: "tp",     title: "Spontantrip",         text: "" },
  { id: "skip",   title: "Flug verpasst",       text: "Du setzt eine Runde aus." },
  { id: "heal",   title: "Wellness-Tag",        text: "+1 Leben." },
  { id: "hurt",   title: "Sonnenstich",         text: "−1 Leben." },
  { id: "item",   title: "Duty-free",           text: "Du bekommst ein Item." },
  { id: "swap",   title: "Platztausch",         text: "" },
  { id: "again",  title: "Rückenwind",          text: "Du darfst gleich nochmal würfeln." },
];

/* Minispiele – neue einfach hier eintragen (und im Browser unter MINIGAMES die Oberfläche dazu) */
const MINIGAMES = {
  sushi:  { name: "Sushi-Rallye",   cont: "AS", place: "Japan",    dur: 10000, bot: () => 22 + rnd(26) },
  reflex: { name: "Taxi-Start",     cont: "NA", place: "New York", dur: 9000,  bot: () => 1300 + rnd(450) },
};

const LOOK_MAX = { skin: 8, hair: 7, hairc: 6, hat: 9, glasses: 5, shirt: 8, shoes: 6 };

/* ---------- kleine Helfer ---------- */
function rnd(n) { return Math.floor(Math.random() * n); }
function pick(a) { return a[rnd(a.length)]; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const AIRPORTS = N.map((n, i) => (n.t === "air" ? i : -1)).filter((i) => i >= 0);
const LANDMARKS = N.map((n, i) => (n.lm ? i : -1)).filter((i) => i >= 0);
function airportOf(cont) { const a = AIRPORTS.find((i) => N[i].c === cont); return a == null ? BOARD.start : a; }

/* Entfernung in Feldern (Laufrichtung beachtet) – für die Bots und den Koffer-Kompass */
const distCache = {};
function distTo(target) {
  if (distCache[target]) return distCache[target];
  const rev = N.map(() => []);
  N.forEach((n, i) => n.n.forEach((j) => rev[j].push(i)));
  const d = new Array(N.length).fill(999); d[target] = 0;
  const q = [target];
  while (q.length) { const v = q.shift(); for (const w of rev[v]) if (d[w] > d[v] + 1) { d[w] = d[v] + 1; q.push(w); } }
  return (distCache[target] = d);
}

/* ---------- Spielstand ---------- */
function newGame(hostId) {
  return {
    phase: "lobby",            // lobby → play ⇄ mini → end
    hostId: hostId || null,
    set: { stamps: 3 },
    players: [],
    order: [], turn: 0, round: 1,
    step: null, owners: {},
    caseNode: -1, caseCont: null, usedConts: [],
    mini: null, result: null, again: false,
    wake: 0, botN: 0,
  };
}
function cleanName(s) { return String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 20) || "Spieler"; }
function cleanLook(l, seat) {
  const o = {};
  for (const k in LOOK_MAX) { const v = l && Number.isInteger(l[k]) ? l[k] : null; o[k] = v != null && v >= 0 && v < LOOK_MAX[k] ? v : 0; }
  if (!l) { o.skin = seat % LOOK_MAX.skin; o.shirt = (seat * 3 + 1) % LOOK_MAX.shirt; o.hat = (seat * 2 + 1) % LOOK_MAX.hat; o.shoes = seat % LOOK_MAX.shoes; o.hair = (seat * 3 + 2) % LOOK_MAX.hair; o.hairc = (seat * 5 + 1) % LOOK_MAX.hairc; o.glasses = seat % 3 === 2 ? 1 + (seat % 4) : 0; }
  return o;
}
function P(S, id) { return S.players.find((p) => p.id === id); }
function cur(S) { return P(S, S.order[S.turn]); }
function others(S, p) { return S.players.filter((q) => q.id !== p.id); }
function freshPlayer(S, id, name, bot, look) {
  const seat = S.players.length;
  return { id, name: cleanName(name), bot: !!bot, on: true, afk: false, seat, look: cleanLook(look, seat),
           pos: BOARD.start, prev: null, coins: CFG.START_COINS, lives: CFG.START_LIVES,
           stamps: [], items: [], skip: 0, buff: null, slow: false, disc: false };
}

/* Beitreten / Verlassen (ruft der Server auf) */
function join(S, id, name, look) {
  let p = P(S, id);
  if (p) { p.on = true; p.name = cleanName(name); return { ok: true }; }
  if (S.players.length >= CFG.MAX_PLAYERS) return { ok: false, err: "Das Spiel ist voll (max. " + CFG.MAX_PLAYERS + " Spieler)." };
  p = freshPlayer(S, id, name, false, look);
  S.players.push(p);
  if (!S.hostId) S.hostId = id;
  if (S.phase !== "lobby" && S.phase !== "end") S.order.push(id);   // Nachzügler spielen ab der nächsten Runde mit
  return { ok: true };
}
function leave(S, id) {
  const p = P(S, id); if (!p) return;
  if (S.phase === "lobby") {
    S.players = S.players.filter((q) => q.id !== id);
    S.players.forEach((q, i) => (q.seat = i));
  } else p.on = false;
  if (S.hostId === id) { const h = S.players.find((q) => q.on && !q.bot); if (h) S.hostId = h.id; }
}

/* ---------- Ereignisse & Dauer (für die Animationen im Browser) ---------- */
function DUR(e) {
  switch (e.e) {
    case "roll": return 2300; case "move": return 430 * e.path.length + 250;
    case "card": return 4200; case "tp": return 1700; case "swap": return 1700; case "fly": return 4300;
    case "stamp": return 7500; case "caseSpawn": return 2600; case "ko": return 2400; case "miniEnd": return 6500;
    case "skip": return 1300; case "item": return 1700; case "toll": return 1400; case "turn": return 600;
    case "coins": case "life": case "got": case "buy": case "caseNo": return 800;
    default: return 300;
  }
}

function addCoins(S, ev, p, d, why) {
  const before = p.coins; p.coins = Math.max(0, p.coins + d);
  if (p.coins !== before) ev.push({ e: "coins", p: p.id, d: p.coins - before, why: why || "" });
  return p.coins - before;
}
function heal(S, ev, p, n, why) {
  const before = p.lives; p.lives = Math.min(CFG.MAX_LIVES, p.lives + n);
  if (p.lives !== before) ev.push({ e: "life", p: p.id, d: p.lives - before, why: why || "" });
}
function hurt(S, ev, p, n, why) {
  p.lives -= n; ev.push({ e: "life", p: p.id, d: -n, why: why || "" });
  if (p.lives <= 0) {
    const lost = Math.floor(p.coins / 2);
    p.coins -= lost; p.lives = CFG.START_LIVES; p.skip += 1;
    p.pos = airportOf(N[p.pos].c); p.prev = null;
    ev.push({ e: "ko", p: p.id, lost, to: p.pos });
  }
}
function giveItem(S, ev, p, id) {
  if (p.items.length >= CFG.MAX_ITEMS) { ev.push({ e: "got", p: p.id, item: id, full: true }); addCoins(S, ev, p, 3, "Tasche voll"); return; }
  p.items.push(id); ev.push({ e: "got", p: p.id, item: id });
}
function casePrice(p) { return p.disc ? CFG.CASE_DISC : CFG.CASE_PRICE; }

/* ---------- Koffer ---------- */
function spawnCase(S, ev) {
  let pool = CONT_KEYS.filter((c) => !S.usedConts.includes(c));
  if (!S.usedConts.length && pool.length > 1) pool = pool.filter((c) => c !== N[BOARD.start].c);   // erster Koffer nicht direkt vor der Haustür
  if (!pool.length) { S.caseNode = -1; S.caseCont = null; return false; }
  const cont = pick(pool);
  const occupied = new Set(S.players.map((p) => p.pos));
  let spots = N.map((n, i) => i).filter((i) => N[i].c === cont && N[i].t !== "air" && !occupied.has(i));
  if (!spots.length) spots = N.map((n, i) => i).filter((i) => N[i].c === cont && N[i].t !== "air");
  S.caseNode = pick(spots); S.caseCont = cont; S.usedConts.push(cont);
  ev.push({ e: "caseSpawn", node: S.caseNode, cont });
  return true;
}
function ranking(S) {
  return S.players.slice().sort((a, b) => b.stamps.length - a.stamps.length || b.coins - a.coins || b.lives - a.lives)
    .map((p) => ({ p: p.id, stamps: p.stamps.length, coins: p.coins }));
}
function finish(S, ev) {
  S.phase = "end"; S.step = null; S.mini = null;
  S.result = { rank: ranking(S) }; S.result.winner = S.result.rank[0].p;
  ev.push({ e: "end", winner: S.result.winner });
}
function openCase(S, ev, p) {
  const price = casePrice(p);
  p.coins -= price; p.disc = false;
  ev.push({ e: "coins", p: p.id, d: -price, why: "Koffer" });
  p.stamps.push(S.caseCont);
  ev.push({ e: "stamp", p: p.id, cont: S.caseCont, node: S.caseNode, count: p.stamps.length });
  if (p.stamps.length >= S.set.stamps) { finish(S, ev); return; }
  if (!spawnCase(S, ev)) finish(S, ev);      // alle 7 Kontinente verbraucht → meiste Stempel gewinnt
}

/* ---------- Zugablauf ---------- */
function exits(p) {
  let ex = N[p.pos].n;
  if (ex.length > 1 && p.prev != null) { const f = ex.filter((x) => x !== p.prev); if (f.length) ex = f; }   // nicht direkt umdrehen
  return ex;
}
function nextTurn(S, ev) {
  if (S.phase !== "play") return;
  if (S.again) { S.again = false; S.step = { k: "pre", used: false }; ev.push({ e: "turn", p: cur(S).id, again: true }); return; }
  for (;;) {
    S.turn++;
    if (S.turn >= S.order.length) { startMini(S, ev); return; }
    const p = cur(S); if (!p) continue;
    if (p.skip > 0) { p.skip--; ev.push({ e: "skip", p: p.id }); continue; }
    S.step = { k: "pre", used: false }; ev.push({ e: "turn", p: p.id });
    return;
  }
}
function advance(S, ev) {
  const p = cur(S), st = S.step;
  let path = [];
  const flush = () => { if (path.length) { ev.push({ e: "move", p: p.id, path }); path = []; } };
  while (st.left > 0) {
    const ex = exits(p);
    if (ex.length > 1 && st.go == null) { flush(); S.step = { k: "branch", left: st.left, opts: ex }; return; }
    const to = st.go != null ? st.go : ex[0]; st.go = null;
    p.prev = p.pos; p.pos = to; path.push(to); st.left--;
    if (to === S.caseNode) {
      flush();
      if (p.coins >= casePrice(p)) { S.step = { k: "case", left: st.left, price: casePrice(p) }; return; }
      ev.push({ e: "caseNo", p: p.id, need: casePrice(p) - p.coins });
    }
    if (N[to].t === "air" && p.coins >= CFG.FLY_PRICE) { flush(); S.step = { k: "air", left: st.left }; return; }
  }
  flush(); land(S, ev);
}
function land(S, ev) {
  const p = cur(S), node = N[p.pos];
  switch (node.t) {
    case "coin": addCoins(S, ev, p, CFG.COIN_FIELD, "Münzfeld"); break;
    case "life": if (p.lives < CFG.MAX_LIVES) heal(S, ev, p, 1, "Herzfeld"); else addCoins(S, ev, p, 2, "Herzfeld"); break;
    case "item": giveItem(S, ev, p, pick(Math.random() < 0.45 ? GOOD_ITEMS : WEAK_ITEMS)); break;
    case "luck": if (drawCard(S, ev, p)) return; break;
    case "prop": {
      const o = S.owners[p.pos];
      if (!o) { if (p.coins >= CFG.PROP_PRICE) { S.step = { k: "buy", price: CFG.PROP_PRICE }; return; } }
      else if (o.p === p.id) addCoins(S, ev, p, CFG.OWN_BONUS, "Dein Zollfeld");
      else {
        const owner = P(S, o.p);
        if (o.toll === "life") {
          ev.push({ e: "toll", p: p.id, owner: o.p, node: p.pos, kind: "life" });
          if (owner) heal(S, ev, owner, 1, "Zoll");
          hurt(S, ev, p, 1, "Zoll");
        } else {
          const amt = Math.min(CFG.TOLL, p.coins);
          ev.push({ e: "toll", p: p.id, owner: o.p, node: p.pos, kind: "coin", amt });
          if (amt) { addCoins(S, ev, p, -amt, "Zoll"); if (owner) addCoins(S, ev, owner, amt, "Zoll"); }
          else hurt(S, ev, p, 1, "Zoll (keine Coins)");
        }
      }
      break;
    }
  }
  nextTurn(S, ev);
}
/* gibt true zurück, wenn die Karte den Zug selbst weiterführt (z. B. Koffer-Frage nach einem Spontantrip) */
function drawCard(S, ev, p) {
  const c = pick(CARDS), o = others(S, p);
  const card = { id: c.id, title: c.title, text: c.text };
  if (c.id === "tp") {
    const to = pick(LANDMARKS.filter((i) => i !== p.pos));
    card.text = "Du reist sofort weiter: " + N[to].lm + " (" + CONTS[N[to].c].name + ").";
    ev.push({ e: "card", p: p.id, card });
    p.pos = to; p.prev = null; ev.push({ e: "tp", p: p.id, to });
    if (to === S.caseNode && p.coins >= casePrice(p)) { S.step = { k: "case", left: 0, price: casePrice(p), noland: true }; return true; }
    return false;
  }
  if (c.id === "swap") {
    if (!o.length) { card.text = "Niemand zum Tauschen da – du bekommst 3 T-Coins."; ev.push({ e: "card", p: p.id, card }); addCoins(S, ev, p, 3, "Glückskarte"); return false; }
    const q = pick(o);
    card.text = "Du tauschst den Platz mit " + q.name + ".";
    ev.push({ e: "card", p: p.id, card });
    const t = p.pos; p.pos = q.pos; q.pos = t; p.prev = null; q.prev = null;
    ev.push({ e: "swap", a: p.id, b: q.id });
    return false;
  }
  ev.push({ e: "card", p: p.id, card });
  switch (c.id) {
    case "lotto": addCoins(S, ev, p, 10, "Glückskarte"); break;
    case "found": addCoins(S, ev, p, 5, "Glückskarte"); break;
    case "tourist": addCoins(S, ev, p, -5, "Glückskarte"); break;
    case "payall": for (const q of o) { const d = -addCoins(S, ev, p, -3, "Glückskarte"); if (d) addCoins(S, ev, q, d, "Glückskarte"); } break;
    case "getall": for (const q of o) { const d = -addCoins(S, ev, q, -3, "Glückskarte"); if (d) addCoins(S, ev, p, d, "Glückskarte"); } break;
    case "skip": p.skip += 1; break;
    case "heal": if (p.lives < CFG.MAX_LIVES) heal(S, ev, p, 1, "Glückskarte"); else addCoins(S, ev, p, 2, "Glückskarte"); break;
    case "hurt": hurt(S, ev, p, 1, "Glückskarte"); break;
    case "item": giveItem(S, ev, p, pick(Math.random() < 0.5 ? GOOD_ITEMS : WEAK_ITEMS)); break;
    case "again": S.again = true; break;
  }
  return false;
}

/* ---------- Minispiel-Runde ---------- */
function startMini(S, ev) {
  const keys = Object.keys(MINIGAMES);
  let game = pick(keys);
  if (keys.length > 1 && S.lastMini === game) game = pick(keys.filter((k) => k !== game));
  S.lastMini = game;
  S.phase = "mini"; S.step = null;
  S.mini = { game, scores: {}, fresh: true };
  ev.push({ e: "mini", game, round: S.round });
}
function finishMini(S, ev) {
  const g = MINIGAMES[S.mini.game];
  const rows = S.players.map((p) => {
    let s = S.mini.scores[p.id];
    if (s == null) s = p.bot || !p.on ? g.bot() : 0;
    return { p: p.id, score: s, tie: Math.random() };
  }).sort((a, b) => b.score - a.score || a.tie - b.tie);
  rows.forEach((r, i) => {
    const p = P(S, r.p); delete r.tie;
    r.coins = CFG.MINI_COINS[i] || 1; p.coins += r.coins;
    r.item = null;
    if (r.score > 0 || p.bot) {
      if (i === 0) r.item = pick(GOOD_ITEMS); else if (i <= 2) r.item = pick(WEAK_ITEMS);
      if (r.item) { if (p.items.length < CFG.MAX_ITEMS) p.items.push(r.item); else { r.full = true; p.coins += 3; } }
    }
  });
  ev.push({ e: "miniEnd", game: S.mini.game, rows });
  S.mini = null; S.phase = "play"; S.round++; S.turn = -1;
  nextTurn(S, ev);
}

/* ---------- Aktionen der Spieler ---------- */
function act(S, id, a, ev) {
  const me = P(S, id);
  if (!me || !a || typeof a.t !== "string") return "Unbekannte Aktion.";
  const host = S.hostId === id;

  if (a.t === "look") { if (S.phase !== "lobby" && S.phase !== "end") return "Das Aussehen kannst du nur in der Lobby ändern."; me.look = cleanLook(a.look || {}, me.seat); return null; }

  if (S.phase === "lobby") {
    if (!host) return "Das darf nur der Host.";
    if (a.t === "set") { const n = Math.round(Number(a.stamps)); if (n >= 1 && n <= 7) S.set.stamps = n; return null; }
    if (a.t === "bot") {
      if (a.remove) { const i = S.players.map((p) => p.bot).lastIndexOf(true); if (i >= 0) S.players.splice(i, 1); S.players.forEach((q, k) => (q.seat = k)); return null; }
      if (S.players.length >= CFG.MAX_PLAYERS) return "Mehr als " + CFG.MAX_PLAYERS + " Spieler gehen nicht.";
      const names = ["Bot Bruno", "Bot Lotte", "Bot Kiwi", "Bot Mango", "Bot Yuki", "Bot Paco", "Bot Zuri"];
      S.botN++; S.players.push(freshPlayer(S, "bot" + S.botN, names[(S.botN - 1) % names.length], true, null));
      return null;
    }
    if (a.t === "start") {
      if (S.players.length < 2) return "Ihr braucht mindestens 2 Spieler – füge sonst einen Bot hinzu.";
      for (const p of S.players) Object.assign(p, { pos: BOARD.start, prev: null, coins: CFG.START_COINS, lives: CFG.START_LIVES, stamps: [], items: [], skip: 0, buff: null, slow: false, disc: false, afk: false });
      S.order = shuffle(S.players.map((p) => p.id));
      S.owners = {}; S.usedConts = []; S.round = 1; S.result = null; S.again = false; S.mini = null;
      S.phase = "play"; S.turn = -1;
      ev.push({ e: "start", order: S.order.slice() });
      spawnCase(S, ev);
      nextTurn(S, ev);
      return null;
    }
    return "Das geht in der Lobby nicht.";
  }
  if (S.phase === "end") {
    if (a.t === "lobby") { if (!host) return "Das darf nur der Host."; S.phase = "lobby"; S.players = S.players.filter((p) => p.on || p.bot); S.players.forEach((q, k) => (q.seat = k)); S.step = null; ev.push({ e: "lobby" }); return null; }
    return "Das Spiel ist vorbei.";
  }
  if (S.phase === "mini") {
    if (a.t !== "score") return "Gerade läuft ein Minispiel.";
    if (S.mini.scores[id] == null) S.mini.scores[id] = Math.max(0, Math.min(100000, Math.round(Number(a.v) || 0)));
    if (S.players.every((p) => p.bot || !p.on || S.mini.scores[p.id] != null)) finishMini(S, ev);
    return null;
  }

  /* ---- phase "play" ---- */
  const p = cur(S), st = S.step;
  if (!p || p.id !== id) return "Du bist gerade nicht dran.";
  me.afk = !!a.auto;

  if (st.k === "pre") {
    if (a.t === "item") {
      if (st.used) return "Pro Zug nur ein Item.";
      const it = p.items[a.i], def = ITEMS[it];
      if (!def) return "Dieses Item hast du nicht.";
      let target = null;
      if (def.pick === "player") { target = P(S, a.target); if (!target || target.id === p.id) return "Wähle einen Mitspieler."; }
      if (def.pick === "value" && !(a.v >= 1 && a.v <= 6)) return "Wähle eine Zahl von 1 bis 6.";
      if (def.pick === "airport" && (!AIRPORTS.includes(a.to) || a.to === p.pos)) return "Wähle einen Flughafen.";
      p.items.splice(a.i, 1); st.used = true;
      ev.push({ e: "item", p: p.id, item: it, target: target ? target.id : null });
      switch (it) {
        case "double": p.buff = "double"; break;
        case "mini": p.buff = "mini"; break;
        case "gold": p.buff = { gold: Math.round(a.v) }; break;
        case "voucher": p.disc = true; break;
        case "plaster": if (p.lives < CFG.MAX_LIVES) heal(S, ev, p, 1, "Pflaster"); else addCoins(S, ev, p, 2, "Pflaster"); break;
        case "piggy": addCoins(S, ev, p, 4, "Sparschwein"); break;
        case "thief": { const d = -addCoins(S, ev, target, -8, "Langfinger"); if (d) addCoins(S, ev, p, d, "Langfinger"); break; }
        case "glove": hurt(S, ev, target, 1, "Boxhandschuh"); break;
        case "snail": target.slow = true; break;
        case "ticket": ev.push({ e: "fly", p: p.id, from: p.pos, to: a.to, free: true }); p.pos = a.to; p.prev = null; break;
      }
      return null;
    }
    if (a.t === "roll") {
      let dice;
      if (p.buff === "double") dice = [1 + rnd(6), 1 + rnd(6)];
      else if (p.buff === "mini") dice = [1 + rnd(3)];
      else if (p.buff && p.buff.gold) dice = [p.buff.gold];
      else dice = [1 + rnd(6)];
      let total = dice.reduce((x, y) => x + y, 0);
      const e = { e: "roll", p: p.id, dice, total, kind: typeof p.buff === "string" ? p.buff : p.buff ? "gold" : "" };
      if (p.slow) { total = Math.ceil(total / 2); e.total = total; e.slow = true; p.slow = false; }
      p.buff = null; ev.push(e);
      S.step = { k: "move", left: total };
      advance(S, ev);
      return null;
    }
    return "Würfle oder benutze ein Item.";
  }
  if (st.k === "branch") {
    if (a.t !== "go" || !st.opts.includes(a.to)) return "Wähle einen der markierten Wege.";
    S.step = { k: "move", left: st.left, go: a.to }; advance(S, ev); return null;
  }
  if (st.k === "case") {
    if (a.t !== "case") return "Koffer öffnen – ja oder nein?";
    if (a.buy && p.coins >= casePrice(p)) { openCase(S, ev, p); if (S.phase !== "play") return null; }
    if (st.noland) { nextTurn(S, ev); return null; }
    S.step = { k: "move", left: st.left }; advance(S, ev); return null;
  }
  if (st.k === "air") {
    if (a.t !== "fly") return "Fliegen – ja oder nein?";
    if (a.to != null) {
      if (!AIRPORTS.includes(a.to) || a.to === p.pos) return "Wähle einen anderen Flughafen.";
      if (p.coins < CFG.FLY_PRICE) return "Zu wenig T-Coins.";
      addCoins(S, ev, p, -CFG.FLY_PRICE, "Flugticket");
      ev.push({ e: "fly", p: p.id, from: p.pos, to: a.to }); p.pos = a.to; p.prev = null;
      nextTurn(S, ev); return null;
    }
    S.step = { k: "move", left: st.left }; advance(S, ev); return null;
  }
  if (st.k === "buy") {
    if (a.t !== "buy") return "Feld beanspruchen – ja oder nein?";
    if ((a.toll === "coin" || a.toll === "life") && p.coins >= CFG.PROP_PRICE && !S.owners[p.pos]) {
      addCoins(S, ev, p, -CFG.PROP_PRICE, "Zollfeld");
      S.owners[p.pos] = { p: p.id, toll: a.toll };
      ev.push({ e: "buy", p: p.id, node: p.pos, toll: a.toll });
    }
    nextTurn(S, ev); return null;
  }
  return "Das geht gerade nicht.";
}

/* ---------- Bots & Zeitüberschreitung ---------- */
function autoAction(S, p, smart) {
  const st = S.step;
  const wantCase = S.caseNode >= 0 && p.coins >= casePrice(p) - 12;
  if (st.k === "pre") {
    if (smart && !st.used && p.items.length && Math.random() < 0.55) {
      const i = rnd(p.items.length), it = p.items[i], def = ITEMS[it], o = others(S, p);
      if (def.pick === "player") { if (o.length) return { t: "item", i, target: pick(o).id }; }
      else if (def.pick === "value") return { t: "item", i, v: 4 + rnd(3) };
      else if (def.pick === "airport") { const to = airportOf(S.caseCont); if (wantCase && to !== p.pos && N[p.pos].c !== S.caseCont) return { t: "item", i, to }; }
      else return { t: "item", i };
    }
    return { t: "roll" };
  }
  if (st.k === "branch") {
    if (smart && wantCase) { const d = distTo(S.caseNode); return { t: "go", to: st.opts.slice().sort((a, b) => d[a] - d[b])[0] }; }
    return { t: "go", to: pick(st.opts) };
  }
  if (st.k === "case") return { t: "case", buy: smart };
  if (st.k === "air") {
    if (smart && wantCase && p.coins >= casePrice(p) + CFG.FLY_PRICE && N[p.pos].c !== S.caseCont) {
      const to = airportOf(S.caseCont), d = distTo(S.caseNode);
      if (to !== p.pos && d[to] + 3 < d[p.pos]) return { t: "fly", to };
    }
    return { t: "fly", to: null };
  }
  if (st.k === "buy") return { t: "buy", toll: smart && p.coins >= CFG.PROP_PRICE + 14 ? (Math.random() < 0.7 ? "coin" : "life") : null };
  return { t: "roll" };
}

/* ---------- Schnittstelle nach aussen ---------- */
function setWake(S, now, ev) {
  const busy = now + ev.reduce((t, e) => t + DUR(e), 0);
  if (S.phase === "play") {
    const p = cur(S);
    S.wake = busy + (p && (p.bot || !p.on) ? CFG.BOT_MS : p && p.afk ? CFG.AFK_AGAIN_MS : CFG.AFK_MS);
  } else if (S.phase === "mini") {
    if (S.mini.fresh) { S.mini.fresh = false; S.wake = busy + CFG.MINI_INTRO_MS + MINIGAMES[S.mini.game].dur + 5000; }
  } else S.wake = 0;
}
/* Aktion eines Spielers. Rückgabe: { ev:[…] } oder { err:"…" } */
function apply(S, id, a, now) {
  const ev = [];
  const err = act(S, id, a, ev);
  if (err) return { err };
  setWake(S, now, ev);
  return { ev };
}
/* Regelmässig aufrufen: zieht für Bots / Abwesende, beendet Minispiele. Rückgabe: { ev } oder null */
function tick(S, now) {
  if (!S.wake || now < S.wake) return null;
  const ev = [];
  if (S.phase === "mini") finishMini(S, ev);
  else if (S.phase === "play") {
    const p = cur(S);
    if (!p) nextTurn(S, ev);
    else {
      const smart = p.bot;
      const a = autoAction(S, p, smart); if (!smart) a.auto = true;
      const err = act(S, p.id, a, ev);
      if (err) { const e2 = act(S, p.id, S.step.k === "pre" ? { t: "roll" } : autoAction(S, p, false), ev); if (e2) nextTurn(S, ev); }
    }
  } else { S.wake = 0; return null; }
  setWake(S, now, ev);
  return { ev };
}

root.WB = { CFG, BOARD, CONTS, CONT_KEYS, ITEMS, MINIGAMES, LOOK_MAX, AIRPORTS, LANDMARKS,
            newGame, join, leave, apply, tick, DUR, distTo, casePrice, exits, airportOf };
})(typeof globalThis !== "undefined" ? globalThis : this);
