import { useEffect, useRef, useState } from "react";
import { StrategyBadge, SpeakButton, SectionTitle, SlideCard, ActivityHeader, useActivityAnswer } from "./Shared";
import { playReveal, playCorrect, playWrong, playClick, playSuccess } from "../utils/audio";

function useSuccessSound() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return () => { timer.current = setTimeout(playSuccess, 400); };
}

/* ========== الشريحة 5: أسباب عودة الدولة - خريطة ذهنية تفاعلية ========== */
const REASONS = [
  { icon: "⚖️", title: "مبادئ وقيم", text: "لأنها دولة ذات مبادئ وقيم راسخة." },
  { icon: "🤲", title: "الحكم العادل", text: "الحكم العادل والعناية بالمواطنين." },
  { icon: "🕊️", title: "الوحدة والاستقرار", text: "الرغبة في عودة الوحدة والاستقرار." },
  { icon: "🤝", title: "التفاف المواطنين", text: "التفاف المواطنين لمساندة الدولة." },
  { icon: "👑", title: "قادة محنكون", text: "وجود قادة محنكين من الأسرة الحاكمة (آل سعود)." },
];

export function ReasonsSlide() {
  const [opened, setOpened] = useState<boolean[]>(Array(REASONS.length).fill(false));
  const open = (i: number) => {
    if (opened[i]) return;
    playReveal();
    setOpened((o) => o.map((v, j) => (j === i ? true : v)));
  };
  return (
    <SlideCard>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <SectionTitle icon="❓">لماذا عادت الدولة السعودية مرة ثانية؟</SectionTitle>
        <StrategyBadge name="الخريطة الذهنية" icon="🗺️" />
      </div>
      <p className="text-slate-600 font-semibold mb-6">اضغط على كل دائرة في الخريطة الذهنية لتكتشف السبب 👇</p>
      <div className="flex flex-col items-center">
        <div className="rounded-2xl bg-rose-700 text-white px-8 py-3 font-black text-xl shadow-lg mb-3">
          أسباب عودة الدولة السعودية
        </div>
        <div className="h-8 w-1 bg-rose-300 rounded-full mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 w-full">
          {REASONS.map((r, i) => (
            <button
              key={i}
              onClick={() => open(i)}
              className={`rounded-2xl border-2 p-4 min-h-36 flex flex-col items-center justify-center gap-2 transition-all ${
                opened[i]
                  ? "bg-teal-50 border-teal-400 shadow-md"
                  : "bg-white border-rose-300 border-dashed hover:scale-105 hover:border-rose-500"
              }`}
            >
              <span className="text-3xl">{opened[i] ? r.icon : "🔒"}</span>
              {opened[i] ? (
                <span className="font-bold text-teal-900 text-sm leading-snug text-center animate-slidein">{r.text}</span>
              ) : (
                <span className="font-extrabold text-rose-700">السبب {["الأول", "الثاني", "الثالث", "الرابع", "الخامس"][i]}</span>
              )}
            </button>
          ))}
        </div>
        {opened.every(Boolean) && (
          <div className="mt-5 bg-amber-50 border border-amber-300 rounded-xl px-6 py-3 font-extrabold text-amber-800 animate-slidein">
            🌟 أحسنت! اكتملت الخريطة الذهنية — ناقش مع مجموعتك: أي الأسباب تراه الأهم ولماذا؟
          </div>
        )}
      </div>
      <div className="mt-6">
        <SpeakButton text="لماذا عادت الدولة السعودية مرة ثانية؟ هناك خمسة أسباب: أولاً: لأنها دولة ذات مبادئ وقيم. ثانياً: الحكم العادل والعناية بالمواطنين. ثالثاً: الرغبة في عودة الوحدة والاستقرار. رابعاً: التفاف المواطنين لمساندة الدولة. خامساً: وجود قادة محنكين من الأسرة الحاكمة آل سعود." />
      </div>
    </SlideCard>
  );
}

/* ========== الشريحة 6: نشاط 1 - فكر زاوج شارك ========== */
export function Activity1Slide() {
  const [a1, setA1] = useActivityAnswer("نشاط١-السبب الأول");
  const [a2, setA2] = useActivityAnswer("نشاط١-السبب الثاني");
  const [showModel, setShowModel] = useState(false);
  return (
    <SlideCard>
      <ActivityHeader number="١" />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">قراءة في قول مؤرخ</h2>
        <StrategyBadge name="فكر - زاوج - شارك" icon="👥" />
      </div>
      <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 mb-5">
        <p className="font-bold text-slate-700 mb-3">قال المؤرخ الفرنسي فيلكس مانجان بعد سقوط الدرعية:</p>
        <blockquote className="border-r-4 border-teal-600 pr-4 text-lg md:text-xl font-extrabold text-teal-900 leading-loose">
          «على الرغم من التدمير الشنيع الذي قامت به القوات العثمانية في الدرعية وما حولها، إلا أن هناك ما يدل على أنها
          ستعود من جديد».
        </blockquote>
      </div>
      <p className="font-extrabold text-rose-700 text-lg mb-4">برأيك، ما الأسباب التي جعلته يتوقع ذلك؟</p>
      <div className="space-y-3 mb-5">
        {[{ v: a1, s: setA1 }, { v: a2, s: setA2 }].map((f, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white font-black">{i + 1}</span>
            <input
              value={f.v}
              onChange={(e) => f.s(e.target.value)}
              placeholder="اكتب إجابتك هنا بعد التفكير والمناقشة مع زميلك…"
              className="flex-1 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 font-semibold focus:border-teal-500 focus:outline-none bg-white"
            />
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-3 mb-5 text-center text-sm">
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200"><span className="text-xl">🤔</span><p className="font-bold text-amber-800 mt-1">فكّر بمفردك دقيقة</p></div>
        <div className="bg-teal-50 rounded-xl p-3 border border-teal-200"><span className="text-xl">👬</span><p className="font-bold text-teal-800 mt-1">زاوج: ناقش زميلك</p></div>
        <div className="bg-rose-50 rounded-xl p-3 border border-rose-200"><span className="text-xl">🗣️</span><p className="font-bold text-rose-800 mt-1">شارك إجابتك مع الصف</p></div>
      </div>
      <button
        onClick={() => { playReveal(); setShowModel(true); }}
        className="rounded-xl bg-teal-700 text-white font-extrabold px-6 py-3 shadow-md hover:bg-teal-800 transition-colors"
      >
        💡 عرض إجابات مقترحة
      </button>
      {showModel && (
        <div className="mt-4 bg-teal-50 border-2 border-teal-300 rounded-2xl p-5 animate-slidein">
          <p className="font-extrabold text-teal-900 mb-2">إجابات مقترحة:</p>
          <ul className="list-disc pr-6 space-y-1.5 font-semibold text-teal-900">
            <li>تمسّك المواطنين بقيادتهم من آل سعود والتفافهم حولها.</li>
            <li>قيام الدولة على الحق والعدل ورسوخ مبادئها وقيمها في النفوس.</li>
          </ul>
        </div>
      )}
      <div className="mt-6">
        <SpeakButton text="نشاط واحد. قال المؤرخ الفرنسي فيلكس مانجان بعد سقوط الدرعية: على الرغم من التدمير الشنيع الذي قامت به القوات العثمانية في الدرعية وما حولها، إلا أن هناك ما يدل على أنها ستعود من جديد. برأيك، ما الأسباب التي جعلته يتوقع ذلك؟ فكر بمفردك، ثم ناقش زميلك، ثم شارك إجابتك مع الصف." />
      </div>
    </SlideCard>
  );
}

/* ========== الشريحة 7: أئمة الدولة السعودية الثانية - ترتيب الخط الزمني ========== */
const IMAMS_CORRECT = [
  { name: "الإمام تركي بن عبدالله", years: "١٢٤٠ - ١٢٤٩هـ" },
  { name: "الإمام فيصل بن تركي", years: "١٢٤٩ - ١٢٨٢هـ" },
  { name: "الإمام عبدالله بن فيصل", years: "١٢٨٢ - ١٣٠٧هـ" },
  { name: "الإمام عبدالرحمن بن فيصل", years: "١٣٠٧ - ١٣٠٩هـ" },
];

export function TimelineSlide() {
  const [pool, setPool] = useState(() => [2, 0, 3, 1]); // ترتيب عشوائي ثابت
  const [placed, setPlaced] = useState<(number | null)[]>([null, null, null, null]);
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const celebrate = useSuccessSound();

  const place = (slot: number) => {
    if (selected === null || placed[slot] !== null) return;
    const imamIdx = selected;
    if (imamIdx === slot) {
      playCorrect();
      const newPlaced = [...placed];
      newPlaced[slot] = imamIdx;
      setPlaced(newPlaced);
      setPool((p) => p.filter((x) => x !== imamIdx));
      setSelected(null);
      if (newPlaced.every((x) => x !== null)) {
        setDone(true);
        celebrate();
      }
    } else {
      playWrong();
      setSelected(null);
    }
  };

  return (
    <SlideCard>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <SectionTitle icon="📜">أئمة الدولة السعودية الثانية</SectionTitle>
        <StrategyBadge name="الخط الزمني التفاعلي" icon="⏳" />
      </div>
      <p className="text-slate-600 font-semibold mb-5">
        اختر اسم الإمام من البطاقات ثم اضغط على مكانه الصحيح في الخط الزمني حسب فترة الحكم 👇
      </p>
      {pool.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6 justify-center">
          {pool.map((idx) => (
            <button
              key={idx}
              onClick={() => { playClick(); setSelected(idx === selected ? null : idx); }}
              className={`rounded-xl px-3 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-extrabold border-2 transition-all shadow-sm ${
                selected === idx
                  ? "bg-amber-400 border-amber-600 text-amber-950 scale-105"
                  : "bg-white border-teal-300 text-teal-800 hover:border-teal-500"
              }`}
            >
              {IMAMS_CORRECT[idx].name}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="absolute top-1/2 right-0 left-0 h-1.5 bg-rose-300 rounded-full -translate-y-1/2 hidden md:block" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 relative">
          {IMAMS_CORRECT.map((imam, slot) => (
            <button
              key={slot}
              onClick={() => place(slot)}
              className={`rounded-2xl border-2 p-4 min-h-36 flex flex-col items-center justify-center gap-2 bg-white transition-all ${
                placed[slot] !== null
                  ? "border-teal-500 bg-teal-50"
                  : selected !== null
                  ? "border-amber-400 border-dashed hover:scale-105 cursor-pointer"
                  : "border-slate-300 border-dashed"
              }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-full font-black text-white ${placed[slot] !== null ? "bg-teal-600" : "bg-rose-700"}`}>
                {["١", "٢", "٣", "٤"][slot]}
              </span>
              {placed[slot] !== null ? (
                <span className="font-extrabold text-teal-900 text-center animate-slidein">{imam.name}</span>
              ) : (
                <span className="text-slate-400 font-bold text-sm">ضع الإمام هنا</span>
              )}
              <span className="text-rose-700 font-black text-sm">{imam.years}</span>
            </button>
          ))}
        </div>
      </div>
      {done && (
        <div className="mt-5 bg-teal-600 text-white rounded-xl px-6 py-3 font-extrabold text-center animate-slidein">
          🎉 أحسنت! رتبت أئمة الدولة السعودية الثانية ترتيباً صحيحاً
        </div>
      )}
      <div className="mt-6">
        <SpeakButton text="أئمة الدولة السعودية الثانية بالترتيب هم: الإمام تركي بن عبدالله من عام ألف ومئتين وأربعين إلى ألف ومئتين وتسعة وأربعين للهجرة. ثم الإمام فيصل بن تركي. ثم الإمام عبدالله بن فيصل. ثم الإمام عبدالرحمن بن فيصل الذي انتهى حكمه عام ألف وثلاثمئة وتسعة للهجرة." />
      </div>
    </SlideCard>
  );
}

/* ========== الشريحة 8: سيرة الإمام تركي بن عبدالله ========== */
export function ImamBioSlide() {
  return (
    <SlideCard>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <SectionTitle icon="⭐">الإمام تركي بن عبدالله بن محمد بن سعود</SectionTitle>
        <StrategyBadge name="التعلم بالمشاهدة" icon="🖼️" />
      </div>
      <p className="text-lg leading-loose font-semibold text-slate-800 mb-6">
        هو الإمام <span className="font-extrabold text-rose-700">تركي بن عبدالله بن محمد بن سعود بن محمد بن مقرن</span>،
        تمكّن من إعادة تأسيس الدولة السعودية في دورها الثاني عام <span className="font-extrabold text-teal-700">١٢٤٠هـ</span>؛
        ليصبح إمامها الأول، ويقودها من جديد. كان متميزاً يحسن التخطيط لتحقيق أهدافه، فحيناً يستعمل أسلوب المواجهة المباشرة
        ضد أعدائه، وفي أحيان أخرى يتخذ سياسة الاختباء حتى تمكّن من محاصرة مدينة الرياض، وطرد الحامية العثمانية المعتدية،
        وأعلن تأسيس الدولة السعودية الثانية وعاصمتها <span className="font-extrabold text-teal-700">الرياض</span>.
      </p>
      <div className="grid md:grid-cols-2 gap-5">
        <figure className="rounded-2xl overflow-hidden border-2 border-teal-200 shadow-md bg-white">
          <img src="/images/mosque-turki.jpg" alt="جامع الإمام تركي بن عبدالله" className="w-full h-56 object-cover" />
          <figcaption className="bg-teal-700 text-white text-center font-bold py-2.5 text-sm">
            جامع الإمام تركي بن عبدالله بالرياض حالياً
          </figcaption>
        </figure>
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5">
          <h3 className="font-extrabold text-amber-900 text-lg mb-3 flex items-center gap-2">🗝️ أساليب الإمام تركي في استعادة الدولة</h3>
          <ul className="space-y-3">
            {[
              ["⚔️", "المواجهة المباشرة ضد الأعداء حيناً."],
              ["🕵️", "سياسة الاختباء والتخفي حيناً آخر."],
              ["🏰", "محاصرة مدينة الرياض وطرد الحامية العثمانية."],
              ["📣", "إعلان تأسيس الدولة السعودية الثانية وعاصمتها الرياض."],
            ].map(([ic, t], i) => (
              <li key={i} className="flex items-start gap-3 bg-white rounded-xl p-3 shadow-sm">
                <span className="text-xl">{ic}</span>
                <span className="font-bold text-slate-700 text-sm leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-6">
        <SpeakButton text="الإمام تركي بن عبدالله بن محمد بن سعود بن محمد بن مقرن، تمكن من إعادة تأسيس الدولة السعودية في دورها الثاني عام ألف ومئتين وأربعين للهجرة، ليصبح إمامها الأول ويقودها من جديد. كان متميزاً يحسن التخطيط لتحقيق أهدافه، فحيناً يستعمل أسلوب المواجهة المباشرة ضد أعدائه، وفي أحيان أخرى يتخذ سياسة الاختباء، حتى تمكن من محاصرة مدينة الرياض وطرد الحامية العثمانية المعتدية، وأعلن تأسيس الدولة السعودية الثانية وعاصمتها الرياض." />
      </div>
    </SlideCard>
  );
}

/* ========== الشريحة 9: صفات الإمام تركي - مطابقة ========== */
const TRAITS = [
  { trait: "الإيمان", desc: "الثقة بالله وإخلاص العمل له", icon: "🤲" },
  { trait: "التخطيط", desc: "وضع خطط مُحكمة لمواجهة التحديات", icon: "🧭" },
  { trait: "الشجاعة", desc: "قيادة المعارك واشتهاره بسيفه المسمى بالأجرب", icon: "🗡️" },
  { trait: "المواطنة", desc: "تحمُّل مسؤولية إعادة الوحدة الوطنية", icon: "🇸🇦" },
  { trait: "العدل", desc: "حرصه على مصالح المواطنين والعدل بينهم", icon: "⚖️" },
];
const DESC_ORDER = [3, 0, 4, 1, 2]; // ترتيب عشوائي للأوصاف

export function TraitsMatchSlide() {
  const [selTrait, setSelTrait] = useState<number | null>(null);
  const [matched, setMatched] = useState<boolean[]>(Array(TRAITS.length).fill(false));
  const [shake, setShake] = useState<number | null>(null);
  const allDone = matched.every(Boolean);
  const celebrate = useSuccessSound();

  const tryMatch = (descIdx: number) => {
    if (selTrait === null || matched[descIdx]) return;
    if (selTrait === descIdx) {
      playCorrect();
      const m = [...matched];
      m[descIdx] = true;
      setMatched(m);
      setSelTrait(null);
      if (m.every(Boolean)) celebrate();
    } else {
      playWrong();
      setShake(descIdx);
      setTimeout(() => setShake(null), 500);
      setSelTrait(null);
    }
  };

  return (
    <SlideCard>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <SectionTitle icon="🏅">صفات الإمام تركي بن عبدالله</SectionTitle>
        <StrategyBadge name="المطابقة (التوصيل)" icon="🔗" />
      </div>
      <p className="text-slate-600 font-semibold mb-6">اضغط على الصفة ثم اضغط على الوصف المناسب لها لتوصيلهما ✨</p>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="font-extrabold text-rose-700 text-center bg-rose-50 rounded-xl py-2 border border-rose-200">الصفة</h3>
          {TRAITS.map((t, i) => (
            <button
              key={i}
              disabled={matched[i]}
              onClick={() => { playClick(); setSelTrait(i === selTrait ? null : i); }}
              className={`w-full rounded-xl border-2 px-4 py-3 font-extrabold flex items-center gap-3 transition-all ${
                matched[i]
                  ? "bg-teal-50 border-teal-400 text-teal-700 opacity-70"
                  : selTrait === i
                  ? "bg-amber-300 border-amber-500 scale-105 shadow-md"
                  : "bg-white border-rose-300 hover:border-rose-500 text-rose-800"
              }`}
            >
              <span className="text-xl">{t.icon}</span> {t.trait} {matched[i] && "✅"}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <h3 className="font-extrabold text-teal-700 text-center bg-teal-50 rounded-xl py-2 border border-teal-200">الوصف</h3>
          {DESC_ORDER.map((descIdx) => (
            <button
              key={descIdx}
              disabled={matched[descIdx]}
              onClick={() => tryMatch(descIdx)}
              className={`w-full rounded-xl border-2 px-4 py-3 font-bold text-sm md:text-base transition-all ${
                matched[descIdx]
                  ? "bg-teal-50 border-teal-400 text-teal-800"
                  : "bg-white border-slate-300 hover:border-teal-500 text-slate-700"
              } ${shake === descIdx ? "animate-shake border-rose-500" : ""}`}
            >
              {TRAITS[descIdx].desc} {matched[descIdx] && "✅"}
            </button>
          ))}
        </div>
      </div>
      {allDone && (
        <div className="mt-5 bg-gradient-to-l from-teal-600 to-teal-700 text-white rounded-xl px-6 py-3 font-extrabold text-center animate-slidein">
          🎉 رائع! طابقت جميع صفات الإمام تركي بن عبدالله بأوصافها الصحيحة
        </div>
      )}
      <div className="mt-6">
        <SpeakButton text="صفات الإمام تركي بن عبدالله خمس: الإيمان: وهو الثقة بالله وإخلاص العمل له. التخطيط: وضع خطط محكمة لمواجهة التحديات. الشجاعة: قيادة المعارك واشتهاره بسيفه المسمى بالأجرب. المواطنة: تحمل مسؤولية إعادة الوحدة الوطنية. العدل: حرصه على مصالح المواطنين والعدل بينهم." />
      </div>
    </SlideCard>
  );
}
