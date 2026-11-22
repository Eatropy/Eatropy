/* Eatropy Kitchen — 材料からフレンチ・イタリアンのレシピを探す / その場で組み立てる */
(function () {
  "use strict";

  var K = window.EATROPY_KITCHEN;
  if (!K) return;

  /* ========== 材料の名前をそろえる ========== */

  function norm(s) {
    return String(s)
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[ァ-ヶ]/g, function (c) {
        return String.fromCharCode(c.charCodeAt(0) - 0x60);
      });
  }

  var exact = {};      // 正規化した表記 → 正式名
  var partial = [];    // 部分一致用(2文字以上、長い順)
  Object.keys(K.aliases).forEach(function (key) {
    [key].concat(K.aliases[key]).forEach(function (a) {
      var n = norm(a);
      exact[n] = key;
      if (n.length >= 2) partial.push({ n: n, key: key });
    });
  });
  partial.sort(function (a, b) { return b.n.length - a.n.length; });

  var pantry = K.pantry.map(norm);

  function resolve(raw) {
    var n = norm(raw);
    if (!n) return null;
    if (pantry.indexOf(n) !== -1 || /(油|オイル|おいる)$/.test(n)) {
      return { raw: raw, key: null, pantry: true };
    }
    if (exact[n]) return { raw: raw, key: exact[n], pantry: false, exact: true };
    for (var i = 0; i < partial.length; i++) {
      if (n.indexOf(partial[i].n) !== -1) return { raw: raw, key: partial[i].key, pantry: false };
    }
    return { raw: raw, key: null, pantry: false };
  }

  function catOf(key) {
    for (var c in K.category) {
      if (K.category[c].indexOf(key) !== -1) return c;
    }
    return "other";
  }

  function joinJa(list) {
    if (list.length === 0) return "";
    if (list.length === 1) return list[0];
    if (list.length === 2) return list[0] + "と" + list[1];
    return list.slice(0, -1).join("、") + "と" + list[list.length - 1];
  }

  /* ========== 登録レシピから探す ========== */

  function entryMatches(entry, keys) {
    if (Array.isArray(entry)) return entry.some(function (e) { return keys.has(e); });
    return keys.has(entry);
  }
  function entryLabel(entry) {
    return Array.isArray(entry) ? entry.join(" / ") : entry;
  }

  function search(keys, cuisine) {
    var out = [];
    K.recipes.forEach(function (r) {
      if (cuisine !== "all" && r.cuisine !== cuisine) return;
      var have = [], missing = [], extras = [];
      r.main.forEach(function (m) {
        (entryMatches(m, keys) ? have : missing).push(entryLabel(m));
      });
      if (have.length === 0) return;
      r.extra.forEach(function (e) { if (keys.has(e)) extras.push(e); });
      var coverage = have.length / r.main.length;
      var score = coverage * 10 + (coverage === 1 ? 5 : 0) + extras.length;
      out.push({ recipe: r, have: have, missing: missing, extras: extras, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 6);
  }

  /* ========== その場でレシピを組み立てる ========== */

  var QTY = {
    "鶏肉": "1枚(250〜300g)", "豚肉": "200〜250g", "牛肉": "200〜250g", "ひき肉": "200g",
    "ベーコン": "50g", "ハム": "3枚", "生ハム": "4枚",
    "ラム": "200〜250g", "鴨": "1枚(200〜250g)", "ソーセージ": "4本",
    "青魚": "2切れ", "牡蠣": "8個", "カニ": "100g", "豆": "1缶(正味120g)", "ナッツ": "大さじ2",
    "白身魚": "2切れ", "鮭": "2切れ", "エビ": "10尾", "ホタテ": "6個", "あさり": "200g(砂抜き済み)",
    "イカ": "150g", "ツナ": "1缶", "卵": "3個",
    "パスタ": "160g", "米": "1合", "パン": "2〜4切れ", "じゃがいも": "2個",
    "トマト": "2個", "玉ねぎ": "1/2個", "ねぎ": "1/2本", "にんにく": "1かけ",
    "バター": "15g", "生クリーム": "100ml", "牛乳": "150ml", "チーズ": "30〜40g", "モッツァレラ": "1個",
    "白ワイン": "50ml", "赤ワイン": "150ml", "レモン": "1/4個", "小麦粉": "少々", "唐辛子": "1本"
  };
  var NEEDS_COOK = ["なす", "じゃがいも", "きのこ", "かぼちゃ", "ブロッコリー", "にんじん", "アスパラガス", "キャベツ", "ほうれん草", "ズッキーニ", "玉ねぎ", "ねぎ",
    "大根", "かぶ", "白菜", "ごぼう", "れんこん", "さつまいも", "里芋", "オクラ", "もやし", "とうもろこし", "いんげん", "グリーンピース", "そら豆", "カリフラワー", "春菊", "ニラ", "ししとう", "ビーツ"];
  // 入力した呼び名(鯛、しめじ など)をそのまま料理名に使う分類
  var LABEL_CATS = ["meat", "seafood", "cured", "veg"];

  var L = K.links;
  var PH = {
    emulsion: "ソースのとろみは「乳化」によるもの。ゆで汁に溶け出したでんぷんが油の粒を包み、本来混ざらない水と油をつなぎとめる。",
    reduce: "煮詰めているあいだ、ソースの温度は水の沸点(約100℃)に張り付く。水分が減るほど味が濃くなるが、水が少なくなると温度が上がって焦げやすくなるので、終盤は火を弱める。",
    cream: "生クリームは乳脂肪が多いので、煮詰めても分離しにくい。牛乳を使うときは、タンパク質が熱と酸で固まりやすいので、ぐらぐら煮立てないこと。",
    risotto: "米を洗わずに使うのは、表面のでんぷんを残すため。でんぷんは60〜70℃以上で水を吸ってふくらみ(糊化)、煮汁にとろみを与える。",
    thickness: "厚みのある料理ほど、中心まで熱が届くのに時間がかかる(かかる時間は厚さの2乗に比例)。弱火でふたをするのは、表面が焦げる前に中まで熱を届けるため。",
    fond: "鍋底にこびりついた茶色い焼き付きは、肉の糖とアミノ酸が高温で反応してできた旨味のかたまり。液体を注いで溶かし出す(デグラッセ)と、それがそのままソースの土台になる。",
    rest: "焼いたあと休ませているあいだも、表面の熱は中心へ伝わり続け、中心温度は数℃上がる。少し早めに火から下ろすのがコツ。",
    fishSalt: "魚に塩をふって置くと、浸透圧で表面から水分が出てくる。それをふき取ってから焼くと、水の蒸発に熱を取られず、皮がパリッと焼ける。",
    whiteSoup: "ぐらぐらと沸かすと、油が細かい粒になって水の中に散らばり(乳化)、スープが白く濁ってまろやかになる。",
    clam: "貝の殻は、ちょうつがいの靭帯がばねのように常に開こうとしていて、それを貝柱の筋肉が閉じている。加熱で貝柱のタンパク質が力を失うと、ばねの力で殻が開く。",
    grill: "野菜の表面の水分が残っているあいだは、蒸発に熱が使われて温度が100℃付近から上がらない。重ならないように並べて水分を飛ばすと、焼き色と香ばしさが出る。",
    potage: "ポタージュのなめらかさは、加熱でやわらかくなった野菜の細胞をミキサーで細かく砕くことで生まれる。じゃがいもが入る場合は、かけすぎるとでんぷんが流れ出して粘るので短めに。",
    egg: "卵黄は約65℃、全卵は約70℃を超えると急に固まり始める。火を止めたフライパンの余熱でその手前にとどめると、ぼそぼそにならずクリーミーに仕上がる。",
    omelette: "卵白は約60℃、卵黄は約65℃で固まり始め、80℃を超えると全体がしっかり固まる。混ぜ続けるのは、鍋肌の熱い卵と表面の冷たい卵を入れ替えて温度をそろえるため。",
    quiche: "高温で焼きすぎると卵液の水分が沸騰して、小さな穴(す)があく。低めの温度で焼き、中の温度を100℃未満にとどめると、なめらかに固まる。",
    gratin: "じゃがいもを水にさらさないのは、表面のでんぷんを残すため。でんぷんが煮汁に溶け出して糊化し、自然なとろみがつく。",
    dressing: "油と酢は、よく混ぜても時間がたつと分かれる。マスタードを少し加えると、その成分が油と酢の境目に入り込み、分離しにくくなる(乳化)。",
    bread: "パンを焼くと表面の水分が飛んで硬い層ができ、具の水分がしみ込みにくくなる。それでも水は少しずつ移動するので、のせるのは食べる直前に。",
    pilaf: "米を先に油で炒めると、表面が油でおおわれて水の吸い込みがゆっくりになり、粒の立ったピラフになる。",
    etuvee: "少ない水分とバターでふたをして蒸し煮にすると、野菜から出た水分が蒸気になって鍋の中を回り、100℃前後の穏やかな温度でむらなく火が通る。"
  };

  function improvise(cuisine, items) {
    var keys = [], labels = {};
    items.forEach(function (it) {
      if (it.pantry || !it.key) return;   // 辞書にない材料は使わない
      if (keys.indexOf(it.key) !== -1) return;
      keys.push(it.key);
      if (it.exact && LABEL_CATS.indexOf(catOf(it.key)) !== -1 && it.key !== "トマト") labels[it.key] = it.raw;
    });
    // 料理の軸になる材料が1つもなければ組み立てない
    var base = keys.filter(function (k) {
      return ["meat", "seafood", "veg"].indexOf(catOf(k)) !== -1 || ["卵", "パスタ", "米", "パン", "じゃがいも"].indexOf(k) !== -1;
    });
    if (base.length === 0) return null;

    var has = function (k) { return keys.indexOf(k) !== -1; };
    var used = {};
    var use = function (k) { used[k] = true; return k; };
    var ofCat = function (c) { return keys.filter(function (k) { return catOf(k) === c; }); };

    var meats = ofCat("meat"), seas = ofCat("seafood"), cureds = ofCat("cured");
    var P = meats[0] || seas[0] || null;
    var C = cureds[0] || null;
    var beans = has("豆");
    var vegsAll = ofCat("veg").filter(function (v) { return v !== "豆"; });
    var beansOnly = beans && vegsAll.length === 0 && !P && !C &&
      !["卵", "パスタ", "米", "パン", "じゃがいも"].some(function (k) { return keys.indexOf(k) !== -1; });
    var fruits = ofCat("fruit");
    var garlic = has("にんにく"), chili = has("唐辛子");
    var cream = has("生クリーム") ? "生クリーム" : (has("牛乳") ? "牛乳" : null);
    var cheese = has("チーズ") ? "チーズ" : (has("モッツァレラ") ? "モッツァレラ" : null);
    var herbs = ["バジル", "パセリ", "ハーブ", "レモン", "ケッパー", "オリーブ", "アンチョビ", "ナッツ"].filter(has);
    var steps = [], name, original, physics, link = null, time;

    function vegsExcept(ex) {
      return vegsAll.filter(function (v) { return ex.indexOf(v) === -1; });
    }
    function useAll(list) { list.forEach(use); return list; }
    function cookNote(list) {
      var need = list.filter(function (v) { return NEEDS_COOK.indexOf(v) !== -1; });
      return need;
    }
    function proteinPrep(p) {
      if (p === "ツナ") return "ツナは油を軽く切っておく。";
      if (p === "あさり") return "あさりは砂抜きし、殻をこすり洗いする。";
      if (p === "エビ") return "エビは殻と背わたを取り、軽く塩をふって水気をふく。";
      if (p === "牡蠣") return "牡蠣は塩水でやさしく洗い、水気をしっかりふく。";
      if (p === "カニ") return "カニの身をほぐしておく。";
      if (catOf(p) === "seafood") return p + "に軽く塩をふって10分おき、出てきた水分をふき取る。";
      if (p === "ひき肉") return "ひき肉に塩・こしょうをして、粘りが出るまでよく練り、小さく丸める。";
      return p + "を食べやすい大きさに切り、塩・こしょうをふる。";
    }
    function doneness(p) {
      if (p === "牛肉" || p === "ラム") return "好みの焼き加減まで焼く。";
      if (catOf(p) === "seafood") return "火を通しすぎないように焼く。";
      return "中心までしっかり火を通す。";
    }
    function aromatics(oil) {
      var parts = [oil];
      if (garlic) parts.push(use("にんにく") && "つぶしたにんにく");
      if (chili && cuisine === "it") parts.push(use("唐辛子"));
      if (parts.length === 1) return "フライパンに" + oil + "を入れて中火で熱する。";
      return "フライパンに" + parts.join("と") + "を入れて弱火にかけ、香りを出す。";
    }
    function finishLine(noCheese) {
      var f = [];
      if (cheese && !noCheese && !used[cheese]) f.push(use(cheese));
      herbs.forEach(function (h) { if (!used[h]) f.push(use(h)); });
      return f.length ? "仕上げに" + joinJa(f) + "を加える。" : "";
    }
    function subjects(list, fallback) {
      var s = list.filter(Boolean).slice(0, 3);
      return s.length ? s.join("と") : fallback;
    }

    if (beansOnly) {
      use("豆");
      if (cuisine === "it") {
        name = "豆のサラダ、レモンとオリーブオイル"; original = "Insalata di legumi"; time = "15分";
        steps.push("豆の水気を切る。");
        steps.push("オリーブオイル大さじ2、" + (has("レモン") ? use("レモン") + "汁" : "レモン汁(または酢)") + "大さじ1、塩・こしょうで和え、10分ほどなじませる。" + finishLine());
        physics = PH.dressing;
      } else {
        name = "豆のポタージュ"; original = "Potage de légumineuses"; time = "20分";
        steps.push("鍋に" + (has("バター") ? use("バター") : "バター") + "を溶かし、水気を切った豆を軽く炒める。");
        steps.push("水200mlを加えて5分煮る。");
        steps.push("ミキサーにかけてなめらかにし、" + (cream ? use(cream) : "牛乳(または水)") + "でのばして温め、塩で味をととのえる。" + finishLine());
        physics = PH.potage;
      }
    } else if (cuisine === "it") {
      /* ---------- Italiano ---------- */
      if (has("パスタ")) {
        use("パスタ");
        var tomato = has("トマト");
        var sauce = tomato ? "tomato" : (cream ? "cream" : (has("卵") ? "uovo" : "olio"));
        var vs = vegsExcept(["トマト"]);
        var subj = subjects([P, C].concat(vs), "");
        name = (subj ? subj + "の" : "シンプルな") + { tomato: "トマトソースパスタ", cream: "クリームパスタ", uovo: "カルボナーラ風", olio: "オイルパスタ" }[sauce];
        original = { tomato: "Pasta al pomodoro", cream: "Pasta alla panna", uovo: "Alla carbonara", olio: "Pasta aglio e olio" }[sauce];
        if (sauce === "uovo") { use("卵"); steps.push("ボウルに卵2個、" + (cheese ? use(cheese) + "大さじ4、" : "") + "こしょうを混ぜておく。"); }
        time = "25分";
        steps.push("鍋に湯を沸かし、湯の1%の塩を入れて、パスタを表示時間より1分短くゆでる。");
        if (P) steps.push(proteinPrep(use(P)));
        if (vs.length) steps.push(joinJa(useAll(vs)) + "は食べやすい大きさに切る。");
        steps.push(aromatics("オリーブオイル"));
        if (C) steps.push(use(C) + "を加え、脂が出るまで炒める。");
        if (P === "あさり") steps.push("あさりと水大さじ3" + (has("白ワイン") ? "(または" + use("白ワイン") + ")" : "") + "を加え、ふたをして殻が開くまで蒸し煮にする。");
        else if (P && catOf(P) === "seafood" && P !== "ツナ") steps.push(P + "を加え、色が変わる程度にさっと火を通す。");
        else if (P && P !== "ツナ") steps.push(P + "を加えて中火で炒め、" + doneness(P));
        if (vs.length) steps.push(joinJa(vs) + "を加えて炒める。");
        if (P === "ツナ") steps.push("ツナを加えてほぐす。");
        if (sauce === "tomato") { use("トマト"); steps.push("トマトを加え、つぶしながら5〜8分煮詰めて、塩で味をととのえる。"); physics = PH.reduce; }
        else if (sauce === "cream") { use(cream); steps.push(cream + "を加え、弱火で軽くとろみがつくまで煮詰める。"); physics = PH.cream; }
        else if (sauce === "uovo") {
          steps.push("ゆで上がったパスタを入れて火を止め、少し冷ましてから卵液とゆで汁少々を加えて手早く混ぜる。とろみが足りなければ、ごく弱火に5秒ずつかける。" + finishLine());
          physics = PH.egg;
        }
        else { steps.push("ゆで汁をお玉1杯加え、フライパンをゆすって白っぽくとろりとさせる。"); physics = PH.emulsion; }
        if (sauce !== "uovo") steps.push("ゆで上がったパスタを入れて手早くからめ、ゆで汁で濃度を調整する。" + finishLine());
      } else if (has("米")) {
        use("米");
        var rv = vegsAll.slice();
        name = subjects([P, C].concat(rv.filter(function (v) { return v !== "玉ねぎ"; })), "パルミジャーノ") + "のリゾット";
        original = "Risotto"; time = "30分";
        if (P) steps.push(proteinPrep(use(P)));
        if (rv.length) steps.push(joinJa(useAll(rv)) + "を小さめに切る。");
        var fryList = (C ? [use(C)] : []).concat(rv);
        steps.push("鍋にオリーブオイルを熱し、" + (fryList.length ? joinJa(fryList) + "を炒める。" : "") + (P ? P + "も加えて表面の色が変わるまで炒める。" : ""));
        steps.push("米を洗わずに加え、油が全体に回るまで炒める。" + (has("白ワイン") ? use("白ワイン") + "を加えて飛ばす。" : ""));
        steps.push("熱いブイヨン(またはお湯+塩)600mlを、お玉1杯ずつ足しながら混ぜ、約16分煮る。");
        steps.push("芯がわずかに残るところで火を止め、" + (has("バター") ? use("バター") + "と" : "") + (cheese ? use(cheese) : "あれば粉チーズ") + "を混ぜ込む。" + finishLine());
        physics = PH.risotto;
      } else if (P && catOf(P) === "seafood") {
        use(P);
        if (P === "ツナ") {
          var tv = vegsAll.slice();
          name = "ツナ" + (tv.length ? "と" + subjects(tv, "") : "") + "のサラダ";
          original = "Insalata di tonno"; time = "15分";
          steps.push(proteinPrep(P));
          var need = cookNote(tv);
          if (need.length) steps.push(joinJa(need) + "は食べやすく切ってゆでるか焼き、冷ましておく。");
          var raw = tv.filter(function (v) { return need.indexOf(v) === -1; });
          if (raw.length) steps.push(joinJa(raw) + "は食べやすい大きさに切る。");
          useAll(tv);
          steps.push("オリーブオイル大さじ2、" + (has("レモン") ? use("レモン") + "汁" : "酢") + "大さじ1、塩・こしょうを混ぜてドレッシングを作る。");
          steps.push("すべてを器に盛り、ドレッシングをかける。" + finishLine());
          physics = PH.dressing;
        } else {
          var av = vegsAll.slice();
          var aqua = has("トマト") || P === "あさり" || P === "白身魚" || has("あさり");
          if (aqua) {
            name = P + (has("あさり") && P !== "あさり" ? "とあさり" : "") + "のアクアパッツァ風";
            original = "All'acqua pazza"; time = "25分";
            steps.push(proteinPrep(P));
            if (av.length) steps.push(joinJa(useAll(av)) + "を食べやすい大きさに切る。");
            steps.push(aromatics("オリーブオイル大さじ2"));
            if (P !== "あさり") steps.push(P + "を入れ、" + (P === "白身魚" || P === "鮭" || P === "青魚" ? "皮目から" : "") + "中火で焼き色をつける。");
            var liquids = [];
            if (has("あさり")) liquids.push(use("あさり"));
            if (av.length) liquids.push(joinJa(av));
            liquids.push((has("白ワイン") ? use("白ワイン") + "50mlと" : "") + "水150ml");
            steps.push(liquids.join("、") + "を加え、ふたをして中火で5〜6分煮る。");
            steps.push("スープを全体にかけながら少し煮詰め、塩で味をととのえる。" + finishLine());
            physics = PH.whiteSoup;
          } else {
            name = P + "のソテー" + (av.length ? "、" + subjects(av, "") + "添え" : "");
            original = "Saltato in padella"; time = "20分";
            steps.push(proteinPrep(P));
            if (av.length) steps.push(joinJa(useAll(av)) + "を食べやすい大きさに切り、オリーブオイルで炒めて塩をふり、皿に盛る。");
            steps.push(aromatics("オリーブオイル"));
            steps.push((garlic ? "中火にして" : "") + P + "を入れ、" + doneness(P));
            steps.push(P + "を盛りつけ、フライパンに残ったオイルを回しかける。" + finishLine());
            physics = PH.fishSalt; link = L.cuke;
          }
        }
      } else if (P) {
        use(P);
        var mv = vegsExcept(["トマト"]);
        if (P === "ひき肉") {
          name = has("トマト") ? "ポルペッテ(ミートボール)のトマト煮" : "ポルペッテ(ミートボール)のソテー";
        } else if (P === "牛肉" && !has("トマト")) {
          name = "牛肉のタリアータ";
        } else {
          name = P + (has("トマト") ? "のトマト煮" : "のソテー、レモンとハーブ風味");
        }
        original = P === "ひき肉" ? "Polpette" : (P === "牛肉" && !has("トマト") ? "Tagliata di manzo" : (has("トマト") ? "Alla pizzaiola" : "In padella"));
        time = has("トマト") ? "35分" : "25分";
        steps.push(proteinPrep(P));
        if (mv.length) steps.push(joinJa(useAll(mv)) + "を食べやすい大きさに切る。");
        var PL = P === "ひき肉" ? "肉団子" : P;
        if (garlic && !has("トマト")) steps.push(aromatics("オリーブオイル"));
        steps.push((garlic && !has("トマト") ? "中火にして" : "フライパンにオリーブオイルを熱し、") + PL + "の表面にしっかり焼き色をつける。" + (has("トマト") ? "いったん取り出す。" : doneness(P)));
        if (has("トマト")) {
          use("トマト");
          var fl = [];
          if (garlic) fl.push(use("にんにく"));
          if (C) fl.push(use(C));
          fl = fl.concat(mv);
          steps.push("同じフライパンで" + (fl.length ? joinJa(fl) + "を炒め、" : "") + (has("白ワイン") ? use("白ワイン") + "で焼き付きをこそげ取ってから、" : "") + "トマトを加える。");
          steps.push(PL + "を戻し、ふたをして弱めの中火で15分煮込む。" + (P === "牛肉" ? "" : "中心までしっかり火を通す。") + "塩で味をととのえる。" + finishLine());
          physics = PH.fond;
        } else {
          if (P === "牛肉") steps.push("取り出してアルミホイルをかぶせ、5分休ませてから薄く切る。");
          if (mv.length || C) steps.push("同じフライパンで" + joinJa((C ? [use(C)] : []).concat(mv)) + "を炒め、塩で味をととのえる。");
          steps.push(PL + "を盛りつけ、" + (mv.length || C ? "炒めたものを添え、" : "") + "オリーブオイルと" + (has("レモン") ? use("レモン") + "汁" : "、あればレモン汁") + "を回しかける。" + finishLine(true));
          physics = P === "牛肉" ? PH.rest : PH.fond;
          if (P === "牛肉") link = L.sous;
        }
      } else if (has("卵")) {
        use("卵");
        var fv = vegsAll.slice();
        name = (fv.length || C ? subjects((C ? [C] : []).concat(fv), "") + "の" : "シンプルな") + "フリッタータ";
        original = "Frittata"; time = "20分";
        if (fv.length || C) steps.push(joinJa((C ? [use(C)] : []).concat(useAll(fv))) + "を小さめに切り、オリーブオイルで火が通るまで炒める。");
        steps.push("卵3個に" + (cheese ? use(cheese) + "と" : "") + "塩・こしょうを混ぜ、フライパンに流し入れる。");
        steps.push("ふたをして、ごく弱火で8〜10分、表面が固まるまで焼く。");
        steps.push("皿をかぶせて裏返し、反対側も1〜2分焼く。" + finishLine());
        physics = PH.thickness; link = L.sous;
      } else if (has("パン")) {
        use("パン");
        var bv = vegsAll.slice();
        name = subjects((C ? [C] : []).concat(bv), "オリーブオイル") + "のブルスケッタ";
        original = "Bruschetta"; time = "15分";
        var bn = cookNote(bv);
        if (bn.length) steps.push(joinJa(bn) + "は小さく切り、オリーブオイルで炒めて塩をふる。");
        var braw = bv.filter(function (v) { return bn.indexOf(v) === -1; });
        if (braw.length) steps.push(joinJa(braw) + "を小さく切り、塩とオリーブオイルで和える。");
        useAll(bv); if (C) use(C);
        steps.push("パンを1.5cm厚さに切り、カリッとするまで焼く。" + (garlic ? "熱いうちに" + use("にんにく") + "の切り口をこすりつける。" : ""));
        var tops = (C ? [C] : []).concat(bv);
        steps.push(tops.length ? "食べる直前に" + joinJa(tops) + "をのせる。" + finishLine() : "オリーブオイルと塩をかける。" + finishLine());
        physics = PH.bread;
      } else if (has("じゃがいも")) {
        use("じゃがいも");
        var pv = vegsExcept(["じゃがいも"]);
        name = "じゃがいも" + (pv.length || C ? "と" + subjects((C ? [C] : []).concat(pv), "") : "") + "のオーブン焼き";
        original = "Patate al forno"; time = "40分";
        steps.push("じゃがいもを一口大に切り、5分ほど下ゆでして水気を飛ばす。");
        if (pv.length) steps.push(joinJa(useAll(pv)) + "を大きめに切る。");
        steps.push("天板に" + joinJa(["じゃがいも"].concat(C ? [use(C)] : []).concat(pv)) + "を重ならないように並べ、オリーブオイル、塩" + (garlic ? "、" + use("にんにく") : "") + (has("ハーブ") ? "、" + use("ハーブ") : "") + "をからめる。");
        steps.push("220℃のオーブンで25〜30分、こんがりするまで焼く。" + finishLine());
        physics = PH.grill;
      } else {
        var gv = vegsAll.concat(C ? [C] : []);
        useAll(gv);
        var vOnly = vegsAll;
        if (has("トマト") && vOnly.length >= 2) {
          name = subjects(vOnly.filter(function (v) { return v !== "トマト"; }), "野菜") + "のカポナータ風";
          original = "Caponata"; time = "35分";
          steps.push(joinJa(vOnly.filter(function (v) { return v !== "トマト"; })) + "を2cm角に切る。");
          steps.push("オリーブオイルで" + (C ? C + "と" : "") + "野菜を焼き色がつくまで炒める。");
          steps.push("トマトを加え、弱めの中火で10分煮る。");
          steps.push("酢大さじ1と砂糖小さじ1を加えてひと煮立ちさせ、塩で味をととのえる。冷ますと味がなじむ。" + finishLine());
          physics = PH.reduce;
        } else {
          name = subjects(gv, "野菜") + "のグリル、オリーブオイルとレモン";
          original = "Verdure grigliate"; time = "20分";
          steps.push(joinJa(gv) + "を1cmほどの厚さに切る。");
          steps.push("フライパン(できればグリルパン)を中火で熱し、重ならないように並べて、両面に焼き色をつける。" + (garlic ? "つぶした" + use("にんにく") + "も一緒に焼いて香りを移す。" : ""));
          steps.push("器に盛り、塩、オリーブオイル、" + (has("レモン") ? use("レモン") + "汁" : "あればレモン汁") + "をかける。" + finishLine());
          physics = PH.grill;
        }
      }
    } else {
      /* ---------- Français ---------- */
      if (P && catOf(P) === "meat") {
        use(P);
        var gar = vegsAll.slice();
        var sauceName, liquid;
        if (has("赤ワイン")) { sauceName = "赤ワインソース"; liquid = use("赤ワイン") + "150ml"; }
        else if (has("マスタード")) { sauceName = "マスタードソース"; liquid = (has("白ワイン") ? use("白ワイン") + "50ml" : "水50ml"); }
        else if (cream) { sauceName = has("きのこ") ? "きのこのクリームソース" : "クリームソース"; liquid = (has("白ワイン") ? use("白ワイン") + "50ml" : "水50ml"); }
        else { sauceName = "焼き汁のソース"; liquid = (has("白ワイン") ? use("白ワイン") + "50ml" : "水50ml"); }
        name = (P === "ひき肉" ? "ステーク・アッシェ(ハンバーグ)" : P + "のソテー") + "、" + sauceName;
        var sauceFr = has("赤ワイン") ? "sauce au vin rouge" : has("マスタード") ? "sauce moutarde" : cream ? "sauce à la crème" : "sauce au jus";
        original = (P === "ひき肉" ? "Steak haché" : "Sauté") + ", " + sauceFr;
        time = has("赤ワイン") ? "35分" : "30分";
        steps.push(P === "ひき肉" ? "ひき肉に塩・こしょうをして粘りが出るまで練り、2つに分けて平たい楕円形にまとめる。" : proteinPrep(P));
        var mushInSauce = sauceName === "きのこのクリームソース";
        var gar2 = gar.filter(function (v) { return !(mushInSauce && v === "きのこ"); });
        if (gar2.length) {
          useAll(gar2);
          steps.push("付け合わせ:" + joinJa(gar2) + "を食べやすく切り、" + (has("バター") ? "バター" : "オリーブオイル") + "と水少々を入れた鍋でふたをして蒸し焼きにし、塩で味をととのえる。");
        }
        steps.push("フライパンに油を熱し、" + (P === "ひき肉" ? "肉" : P) + "を中火で焼く。" + (P === "牛肉" || P === "ラム" ? "好みの焼き加減の少し手前で取り出し、アルミホイルをかぶせて休ませる。" : "中心までしっかり火を通して取り出す。"));
        if (fruits.length) {
          useAll(fruits);
          steps.push(joinJa(fruits) + "を食べやすく切り、バターで両面に焼き色がつくまで焼く(肉の付け合わせにする)。");
        }
        var sauceSteps = "フライパンの余分な脂をふき取り、" + (C ? use(C) + "を炒めてから、" : "") + (garlic ? "つぶした" + use("にんにく") + "を軽く炒めてから、" : "") + (mushInSauce ? use("きのこ") + "を炒めてから、" : "") + liquid + "を加えて、底の焼き付きを溶かしながら半量まで煮詰める。";
        if (has("マスタード")) { use("マスタード"); sauceSteps += "マスタード大さじ1を溶き入れる。"; }
        if (cream) { use(cream); sauceSteps += cream + "100mlを加えて軽く煮詰める。"; }
        sauceSteps += (has("バター") ? use("バター") + "を加えて混ぜ、" : "") + "塩で味をととのえる。";
        steps.push(sauceSteps);
        steps.push("肉を皿に盛ってソースをかけ" + (gar2.length || fruits.length ? "、付け合わせを添える。" : "る。") + finishLine(true));
        if (fruits.length) name += "、" + joinJa(fruits) + "添え";
        physics = P === "牛肉" || P === "ラム" ? PH.rest : PH.fond;
        if (P === "牛肉" || P === "ラム") link = L.sous;
      } else if (P && catOf(P) === "seafood") {
        use(P);
        var sv = vegsAll.slice();
        if (P === "ツナ") {
          name = "ツナ" + (sv.length ? "と" + subjects(sv, "") : "") + "のサラダ、ヴィネグレット";
          original = "Salade composée"; time = "15分";
          var sneed = cookNote(sv);
          if (sneed.length) steps.push(joinJa(sneed) + "は食べやすく切ってゆで、冷ましておく。");
          var sraw = sv.filter(function (v) { return sneed.indexOf(v) === -1; });
          if (sraw.length) steps.push(joinJa(sraw) + "は食べやすい大きさに切る。");
          useAll(sv);
          steps.push("酢大さじ1、" + (has("マスタード") ? use("マスタード") : "あればマスタード") + "小さじ1/2、塩・こしょうを混ぜ、オリーブオイル大さじ3を少しずつ加えながらよく混ぜる(ヴィネグレット)。");
          steps.push("野菜とツナを器に盛り、ヴィネグレットをかける。" + finishLine());
          physics = PH.dressing;
        } else if (P === "あさり") {
          name = "あさり" + (sv.length ? "と" + subjects(sv, "") : "") + "の白ワイン蒸し";
          original = "À la marinière"; time = "15分";
          steps.push(proteinPrep(P));
          var cl = (garlic ? [use("にんにく")] : []).concat(useAll(sv));
          if (cl.length) steps.push("鍋に" + (has("バター") ? use("バター") : "オリーブオイル") + "を入れ、" + joinJa(cl) + "を炒める。");
          steps.push((cl.length ? "" : "鍋に") + "あさりと" + (has("白ワイン") ? use("白ワイン") + "100ml" : "水100ml") + (cl.length ? "" : "、" + (has("バター") ? use("バター") : "オリーブオイル") + "少々") + "を入れ、ふたをして強火で2〜3分蒸し煮にする。" + (cream ? use(cream) + "を少し加えるとまろやかになる。" : ""));
          steps.push("殻が開いたらすぐに火を止める。" + finishLine());
          physics = PH.clam;
        } else {
          var fsauce, butter = has("バター");
          if (butter && has("レモン")) fsauce = "ムニエル風";
          else if (has("トマト")) fsauce = "ソース・ヴィエルジュ";
          else if (cream) fsauce = "クリームソース";
          else fsauce = "焦がしバターソース";
          name = P + "のポワレ、" + fsauce;
          original = "Poêlé"; time = "25分";
          var sv2 = sv.filter(function (v) { return !(fsauce === "ソース・ヴィエルジュ" && v === "トマト"); });
          steps.push(proteinPrep(P));
          if (sv2.length) { useAll(sv2); steps.push("付け合わせ:" + joinJa(sv2) + "を食べやすく切り、バターか油で炒めて塩をふる。"); }
          if (fsauce === "ムニエル風") { use("小麦粉"); steps.push(P + "に薄く小麦粉をはたき、余分な粉を落とす。"); }
          steps.push("フライパンに油" + (garlic ? "とつぶした" + use("にんにく") : "") + "を熱し、" + P + "を" + (P === "白身魚" || P === "鮭" || P === "青魚" ? "皮目から、軽く押さえながら" : "") + "中火で焼く。裏返して、火を通しすぎないうちに取り出す。");
          if (fsauce === "ソース・ヴィエルジュ") {
            use("トマト");
            steps.push("トマトを小さな角切りにし、オリーブオイル大さじ2、" + (has("レモン") ? use("レモン") + "汁、" : "") + "塩と混ぜ、小鍋で人肌程度に温める。");
          } else if (fsauce === "クリームソース") {
            use(cream);
            steps.push("同じフライパンに" + (has("白ワイン") ? use("白ワイン") + "50mlを入れて煮詰め、" : "") + cream + "100mlを加えて軽く煮詰め、塩で味をととのえる。");
          } else {
            if (butter) use("バター");
            steps.push("フライパンの油をふき、バター20gを入れて泡が細かくなり薄く色づくまで加熱する。" + (has("レモン") ? use("レモン") + "汁を加える。" : ""));
          }
          steps.push(P + "を盛りつけてソースをかけ" + (sv2.length ? "、付け合わせを添える。" : "る。") + finishLine(true));
          physics = PH.fishSalt; link = L.cuke;
        }
      } else if (has("卵")) {
        use("卵");
        var ev = vegsAll.slice();
        var fill = (C ? [C] : []).concat(ev);
        if (cream) {
          name = (fill.length ? subjects(fill, "") + "の" : "") + "生地なしキッシュ";
          original = "Quiche sans pâte"; time = "40分";
          if (fill.length) { if (C) use(C); useAll(ev); steps.push(joinJa(fill) + "を小さめに切り、バターか油で炒める。"); }
          use(cream);
          steps.push("卵2個、" + cream + "100ml、塩・こしょうを混ぜる。");
          var inside = [];
          if (fill.length) inside.push("具");
          if (cheese) inside.push(use(cheese));
          steps.push("耐熱皿に" + (inside.length ? inside.join("と") + "を入れ、" : "") + "卵液を注ぐ。");
          steps.push("160℃のオーブンで25〜30分、中心がふるふると固まるまで焼く。" + finishLine());
          physics = PH.quiche;
        } else {
          name = fill.length ? subjects(fill, "") + "のオムレツ" : "プレーンオムレツ";
          original = "Omelette"; time = "15分";
          if (fill.length) { if (C) use(C); useAll(ev); steps.push(joinJa(fill) + "を小さく切り、バターか油で炒めて取り出す。"); }
          steps.push("卵3個を溶き、塩をひとつまみ混ぜる。");
          steps.push("フライパンを中火で熱して" + (has("バター") ? use("バター") : "バター(または油)") + "を溶かし、卵液を流して大きく素早く混ぜる。");
          steps.push("半熟になったら" + (fill.length ? "具" : "") + (cheese ? (fill.length ? "と" : "") + use(cheese) : "") + (fill.length || cheese ? "をのせ、" : "") + "奥へ寄せて木の葉形にまとめる。" + finishLine());
          physics = PH.omelette;
        }
      } else if (has("じゃがいも")) {
        use("じゃがいも");
        var gv2 = vegsExcept(["じゃがいも"]);
        var withDairy = !!cream;
        name = (gv2.length || C ? subjects((C ? [C] : []).concat(gv2), "") + "とじゃがいもの" : "じゃがいもの") + (withDairy ? "グラタン" : "グラタン・サヴォワイヤール風");
        original = withDairy ? "Gratin" : "Gratin savoyard"; time = "50分";
        steps.push("じゃがいもを2〜3mmの薄切りにする(水にさらさない)。" + (gv2.length ? joinJa(useAll(gv2)) + "も薄く切る。" : ""));
        steps.push("鍋に" + (withDairy ? use(cream) + "200ml" : "ブイヨン(またはお湯+塩)200ml") + (garlic ? "とつぶした" + use("にんにく") : "") + "、塩を入れ、" + (C ? use(C) + "と" : "") + "じゃがいもを加えて弱火で10分煮る。");
        steps.push("バターをぬった耐熱皿に移し、" + (cheese ? use(cheese) + "を散らして、" : "") + "170℃のオーブンで30〜40分焼く。" + finishLine());
        physics = PH.gratin;
      } else if (has("米")) {
        use("米");
        var rv2 = vegsAll.slice();
        name = subjects((P ? [P] : []).concat(C ? [C] : []).concat(rv2), "バター") + "のピラフ";
        original = "Riz pilaf"; time = "35分";
        steps.push((rv2.length || C ? joinJa((C ? [use(C)] : []).concat(useAll(rv2))) + "を小さく切る。" : "玉ねぎがあれば、みじん切りにする。"));
        steps.push("鍋に" + (has("バター") ? use("バター") : "バター(または油)") + "を熱して具を炒め、洗って水気を切った米を加え、透き通るまで炒める。");
        steps.push("熱いブイヨン(またはお湯+塩)を米と同量加え、ふたをして弱火で15分炊く。");
        steps.push("火を止めて10分蒸らし、さっくり混ぜる。" + finishLine());
        physics = PH.pilaf;
      } else if (has("パスタ")) {
        use("パスタ");
        var nv = vegsAll.slice();
        var nsub = subjects((C ? [C] : []).concat(nv), "");
        name = (nsub ? nsub + "の" : "") + "パスタ、" + (cream ? "クリームソース" : "バターソース");
        original = cream ? "Nouilles à la crème" : "Nouilles au beurre"; time = "25分";
        steps.push("鍋に湯を沸かし、湯の1%の塩を入れてパスタをゆでる。");
        steps.push("フライパンにバターを溶かし" + (nv.length || C ? "、食べやすく切った" + joinJa((C ? [use(C)] : []).concat(useAll(nv))) + "を炒める。" : "ておく。"));
        if (cream) { use(cream); steps.push(cream + "100mlを加えて軽く煮詰める。"); }
        steps.push("ゆでたパスタとゆで汁少々をフライパンに加えて和え、仕上げに" + (has("バター") ? use("バター") : "バター") + "をひとかけ溶かし込む。" + finishLine());
        physics = cream ? PH.cream : PH.emulsion;
      } else if (has("パン")) {
        use("パン");
        var tv2 = vegsAll.slice();
        name = subjects((C ? [C] : []).concat(tv2), "バター") + "のタルティーヌ";
        original = "Tartine"; time = "15分";
        var tn = cookNote(tv2);
        if (tn.length) steps.push(joinJa(tn) + "は薄く切り、バターで炒めて塩をふる。");
        var traw = tv2.filter(function (v) { return tn.indexOf(v) === -1; });
        if (traw.length) steps.push(joinJa(traw) + "は薄く切る。");
        useAll(tv2);
        steps.push("パンを薄く切り、表面に" + (has("バター") ? use("バター") : "バター") + "をぬって焼く。");
        var tt = (C ? [use(C)] : []).concat(tv2);
        steps.push((tt.length ? joinJa(tt) + "をのせ、" : "") + (cheese ? use(cheese) + "をのせてもう一度焼く。" : "温かいうちに食べる。") + finishLine());
        physics = PH.bread;
      } else {
        var vv = vegsAll.concat(C ? [C] : []);
        useAll(vv);
        var potageable = ["かぼちゃ", "にんじん", "玉ねぎ", "ねぎ", "きのこ", "ブロッコリー", "キャベツ", "アスパラガス"];
        var isPotage = vegsAll.some(function (v) { return potageable.indexOf(v) !== -1; });
        if (isPotage) {
          name = subjects(vegsAll, "野菜") + "のポタージュ";
          original = "Potage"; time = "35分";
          steps.push(joinJa(vv) + "を薄切りにする。");
          steps.push("鍋に" + (has("バター") ? use("バター") : "バター(または油)") + "を溶かし、" + (garlic ? use("にんにく") + "と一緒に、" : "") + "色づけないようにしんなりするまで炒める。");
          steps.push("水をひたひたに加え、やわらかくなるまで15分ほど煮る。");
          steps.push("ミキサーにかけてなめらかにし、" + (cream ? use(cream) : "牛乳(または水)") + "でのばして温め、塩で味をととのえる。" + finishLine());
          physics = PH.potage;
        } else {
          name = subjects(vv, "野菜") + "のエチュヴェ(バター蒸し煮)";
          original = "Légumes étuvés"; time = "20分";
          steps.push(joinJa(vv) + "を食べやすい大きさに切る。");
          steps.push("鍋に" + (has("バター") ? use("バター") : "バター") + "15g、水大さじ3、塩ひとつまみと野菜" + (garlic ? "、つぶした" + use("にんにく") : "") + "を入れ、ふたをして弱めの中火で蒸し煮にする。");
          steps.push("やわらかくなったらふたを取り、水分を飛ばしながらバターをからめる。" + finishLine());
          physics = PH.etuvee;
        }
      }
    }

    if (beans && !used["豆"]) {
      use("豆");
      steps.splice(Math.max(steps.length - 1, 0), 0, "水気を切った豆(缶詰など)を加えて、全体になじませる。");
      name += "(豆入り)";
    }

    // 分量
    var amounts = [];
    keys.forEach(function (k) {
      if (!used[k]) return;
      var q = QTY[k] || (catOf(k) === "veg" ? "100g前後" : "適量");
      amounts.push(k + " " + q);
    });
    if (used["小麦粉"] && !has("小麦粉")) amounts.push("小麦粉 少々");
    amounts.push(cuisine === "fr" ? "バター・油・塩・こしょう 適量" : "オリーブオイル・塩・こしょう 適量");

    var unused = keys.filter(function (k) { return !used[k]; });

    // 入力した呼び名に置き換える(例:白身魚 → 鯛、きのこ → しめじ)
    var swap = Object.keys(labels).filter(function (k) {
      // 「ねぎ」⊂「玉ねぎ」のように、他の材料名の一部になる名前は置き換えない
      return !Object.keys(K.aliases).some(function (o) { return o !== k && o.indexOf(k) !== -1; });
    }).sort(function (a, b) { return b.length - a.length; });
    if (swap.length) {
      var re = new RegExp(swap.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|"), "g");
      var sw = function (t) { return t.replace(re, function (m) { return labels[m]; }); };
      name = sw(name);
      steps = steps.map(sw);
      amounts = amounts.map(sw);
      unused = unused.map(function (k) { return labels[k] || k; });
    }

    return {
      generated: true, cuisine: cuisine, name: name, original: original + "(即興)", time: time,
      amounts: amounts, steps: steps.filter(Boolean), physics: physics, link: link,
      unused: unused
    };
  }

  // テスト・デバッグ用
  K.api = { resolve: resolve, search: search, improvise: improvise };

  /* ========== 画面 ========== */

  var root = document.getElementById("kitchen");
  if (!root) return;
  var input = root.querySelector("#kitchen-input");
  var form = root.querySelector(".kitchen-form");
  var chipsEl = root.querySelector(".kitchen-chips");
  var suggestEl = root.querySelector(".kitchen-suggest");
  var resultsEl = root.querySelector(".kitchen-results");
  var clearBtn = root.querySelector(".kitchen-clear");
  var items = [];

  function cuisineValue() {
    var c = root.querySelector('input[name="cuisine"]:checked');
    return c ? c.value : "all";
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function addRaw(text) {
    String(text).split(/[、,，\n\/・]+|\s+/).forEach(function (part) {
      var r = resolve(part);
      if (!r) return;
      var dup = items.some(function (it) {
        return (r.key && it.key === r.key) || norm(it.raw) === norm(r.raw);
      });
      if (!dup) items.push(r);
    });
    renderChips();
    render();
  }

  function renderChips() {
    chipsEl.textContent = "";
    items.forEach(function (it, i) {
      var chip = el("span", "chip" + (it.pantry ? " is-pantry" : it.key ? "" : " is-unknown"));
      var label = it.raw;
      if (it.key && norm(it.key) !== norm(it.raw)) label += " → " + it.key;
      chip.appendChild(el("span", null, label));
      if (it.pantry) chip.title = "調味料は家にあるものとして扱います";
      else if (!it.key) chip.title = "辞書にない材料です。レシピには使いません";
      var x = el("button", "chip-x", "×");
      x.type = "button";
      x.setAttribute("aria-label", it.raw + " を外す");
      x.addEventListener("click", function () { items.splice(i, 1); renderChips(); render(); });
      chip.appendChild(x);
      chipsEl.appendChild(chip);
    });
    clearBtn.hidden = items.length === 0;
  }

  function cuisineLabel(c) {
    return c === "fr" ? "Français · フランス料理" : "Italiano · イタリア料理";
  }

  function recipeEntry(r, info) {
    var wrap = el("article", "recipe-entry" + (r.generated ? " is-generated" : ""));
    wrap.appendChild(el("div", "meta", cuisineLabel(r.cuisine) + " · " + r.time));
    wrap.appendChild(el("h4", null, r.name));
    wrap.appendChild(el("div", "recipe-original", r.original));

    if (info) {
      var m = el("p", "recipe-match");
      m.appendChild(el("span", "have", "手元の材料:" + info.have.concat(info.extras).join("、")));
      if (info.missing.length) m.appendChild(el("span", "missing", "足りない材料:" + info.missing.join("、")));
      wrap.appendChild(m);
    }
    if (r.generated && r.unused.length) {
      wrap.appendChild(el("p", "recipe-note", "この一皿では使わなかった材料:" + r.unused.join("、")));
    }

    var det = el("details");
    det.appendChild(el("summary", null, "材料と作り方"));
    det.appendChild(el("h5", null, "材料(2人分)"));
    var ul = el("ul", "recipe-amounts");
    r.amounts.forEach(function (a) { ul.appendChild(el("li", null, a)); });
    det.appendChild(ul);
    det.appendChild(el("h5", null, "作り方"));
    var ol = el("ol", "recipe-steps");
    r.steps.forEach(function (s) { ol.appendChild(el("li", null, s)); });
    det.appendChild(ol);
    if (r.physics) {
      var ph = el("div", "recipe-physics");
      ph.appendChild(el("div", "label", "物理の視点から"));
      ph.appendChild(el("p", null, r.physics));
      if (r.link) {
        var a = el("a", null, "関連記事:" + r.link.title + " →");
        a.href = r.link.href;
        ph.appendChild(a);
      }
      det.appendChild(ph);
    }
    wrap.appendChild(det);
    return wrap;
  }

  function render() {
    resultsEl.textContent = "";
    var real = items.filter(function (it) { return !it.pantry; });
    if (real.length === 0) {
      if (items.length) resultsEl.appendChild(el("p", "kitchen-empty", "調味料は家にあるものとして扱います。肉・魚・野菜などの材料を入れてください。"));
      return;
    }
    var keys = new Set(items.filter(function (it) { return it.key; }).map(function (it) { return it.key; }));
    var cuisine = cuisineValue();

    var unknownItems = items.filter(function (it) { return !it.pantry && !it.key; });
    if (unknownItems.length) {
      var box = el("div", "kitchen-unknown");
      box.appendChild(el("p", null, "「" + unknownItems.map(function (it) { return it.raw; }).join("」「") + "」は辞書にない材料なので、レシピには使っていません。ネットで調べることができます。"));
      unknownItems.forEach(function (it) {
        var row = el("p", "kitchen-search");
        [["fr", "フレンチ", "フランス料理"], ["it", "イタリアン", "イタリア料理"]].forEach(function (c) {
          if (cuisine !== "all" && cuisine !== c[0]) return;
          var a = el("a", null, it.raw + " × " + c[1] + " のレシピを検索 ↗");
          a.href = "https://www.google.com/search?q=" + encodeURIComponent(it.raw + " " + c[2] + " レシピ");
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          row.appendChild(a);
        });
        box.appendChild(row);
      });
      resultsEl.appendChild(box);
    }

    var found = search(keys, cuisine);
    var sec1 = el("section", "kitchen-group");
    sec1.appendChild(el("h3", null, "見つかったレシピ"));
    if (found.length === 0) {
      sec1.appendChild(el("p", "kitchen-empty", "この組み合わせに合う登録レシピは見つかりませんでした。下の即興レシピを試してみてください。"));
    } else {
      found.forEach(function (f) { sec1.appendChild(recipeEntry(f.recipe, f)); });
    }
    resultsEl.appendChild(sec1);

    var sec2 = el("section", "kitchen-group");
    sec2.appendChild(el("h3", null, "その場で作る即興レシピ"));
    sec2.appendChild(el("p", "kitchen-caption", "入力した材料を、フレンチ・イタリアンの定番の調理法に当てはめて自動で組み立てた一皿です。分量と加熱時間は目安なので、様子を見ながら調整してください。"));
    var made = 0;
    (cuisine === "all" ? ["fr", "it"] : [cuisine]).forEach(function (c) {
      var g = improvise(c, items);
      if (g) { sec2.appendChild(recipeEntry(g, null)); made++; }
    });
    if (!made) sec2.appendChild(el("p", "kitchen-empty", "組み立てるには、肉・魚・卵・野菜・パスタ・米・パンなど、料理の軸になる材料をもうひとつ入れてください。"));
    resultsEl.appendChild(sec2);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (input.value.trim()) { addRaw(input.value); input.value = ""; }
    else render();
  });
  input.addEventListener("keydown", function (e) {
    if ((e.key === "," || e.key === "、") && input.value.trim()) {
      e.preventDefault();
      addRaw(input.value);
      input.value = "";
    }
  });
  suggestEl.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-ing]");
    if (b) addRaw(b.getAttribute("data-ing"));
  });
  root.querySelectorAll('input[name="cuisine"]').forEach(function (r) {
    r.addEventListener("change", render);
  });
  clearBtn.addEventListener("click", function () {
    items = [];
    renderChips();
    render();
    input.focus();
  });
})();
