import { useState } from "react";
import { StrategyBadge, SpeakButton, SectionTitle, SlideCard } from "./Shared";
import { playFlip, playReveal, playClick } from "../utils/audio";

/* ========== الشريحة 1: الغلاف وأهداف الدرس ========== */
export function CoverSlide() {
  const goals = [
    "أن يبيّن الطالب ما حدث بعد سقوط الدرعية.",
    "أن يستنتج الطالب أسباب عودة الدولة السعودية مرة ثانية.",
    "أن يعدّد الطالب أئمة الدولة السعودية الثانية بالترتيب.",
    "أن يصف الطالب صفات الإمام تركي بن عبدالله.",
    "أن يقارن الطالب بين قصر الحكم قديماً وحديثاً.",
  ];
  return (
    <div className="relative overflow-hidden rounded-3xl shadow-2xl animate-slidein">
      <img src="/images/hero-diriyah.jpg" alt="الدرعية التاريخية" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-teal-950/95 via-teal-900/80 to-teal-900/40" />
      <div className="relative p-5 sm:p-8 md:p-14 text-white">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="rounded-full bg-white/15 backdrop-blur border border-white/30 px-3 py-1.5 text-xs sm:text-sm font-extrabold flex items-center gap-1.5">
            👨‍🏫 المعلم: <span className="text-amber-300">علي عبدالله راجحي</span>
          </span>
          <span className="rounded-full bg-white/15 backdrop-blur border border-white/30 px-3 py-1.5 text-xs sm:text-sm font-extrabold flex items-center gap-1.5">
            🏫 <span className="text-amber-300">مدرسة العروس الابتدائية</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="rounded-full bg-amber-400 text-teal-950 px-3 py-1 text-xs sm:text-sm font-extrabold">الدراسات الاجتماعية</span>
          <span className="rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs sm:text-sm font-bold">الصف السادس الابتدائي</span>
          <span className="rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs sm:text-sm font-bold">الوحدة الثالثة • الدرس السابع</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-black mb-4 leading-tight drop-shadow-lg">
          تأسيس الدولة السعودية <span className="text-amber-300">الثانية</span>
        </h1>
        <p className="text-teal-50 text-base sm:text-lg md:text-xl mb-6 sm:mb-8 max-w-2xl leading-relaxed">
          رحلة تفاعلية نتعرف فيها كيف عادت الدولة السعودية من جديد على يد الإمام تركي بن عبدالله رحمه الله.
        </p>
        <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/25 p-6 max-w-2xl">
          <h2 className="font-extrabold text-amber-300 text-xl mb-4 flex items-center gap-2">🎯 أهداف الدرس</h2>
          <ul className="space-y-2.5">
            {goals.map((g, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-teal-950 text-xs font-black">{i + 1}</span>
                <span className="font-semibold">{g}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-7">
          <SpeakButton
            label="استمع لمقدمة الدرس"
            text="أهلاً بكم أعزائي الطلاب في درس جديد من دروس الدراسات الاجتماعية. درسنا اليوم بعنوان: تأسيس الدولة السعودية الثانية. سنتعرف في هذا الدرس على ما حدث بعد سقوط الدرعية، وأسباب عودة الدولة السعودية، وعلى المؤسس الإمام تركي بن عبدالله رحمه الله، وصفاته العظيمة. هيا بنا نبدأ رحلتنا التعليمية الممتعة."
          />
        </div>
      </div>
    </div>
  );
}

/* ========== الشريحة 2: التهيئة - عصف ذهني ========== */
export function HookSlide() {
  const [revealed, setRevealed] = useState(false);
  return (
    <SlideCard>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <SectionTitle icon="💡">التهيئة للدرس</SectionTitle>
        <StrategyBadge name="العصف الذهني" icon="🧠" />
      </div>
      <div className="bg-rose-50 border-r-4 border-rose-600 rounded-xl p-6 mb-6">
        <p className="text-lg md:text-xl leading-loose font-bold text-slate-800">
          إذا كانت الدول تقوم على <span className="text-rose-700">الحق والعدل</span> فإن الله يكتب لها الاستمرارية والبقاء،
          فعلى الرغم من الدمار الذي لحق بالدولة السعودية الأولى على أيدي الأعداء، فإنه كُتب لها الرجوع مرة أخرى…
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 text-center">
          <span className="text-3xl">🤔</span>
          <p className="font-extrabold text-amber-900 text-lg mt-2">فمن هو مؤسس الدولة السعودية الثانية؟</p>
        </div>
        <div className="bg-teal-50 border-2 border-teal-300 rounded-2xl p-5 text-center">
          <span className="text-3xl">💭</span>
          <p className="font-extrabold text-teal-900 text-lg mt-2">وكيف تم له ذلك؟</p>
        </div>
      </div>
      <p className="text-slate-600 font-semibold mb-4">✋ شارك زملاءك بأفكارك وتوقعاتك قبل كشف الإجابة!</p>
      {!revealed ? (
        <button
          onClick={() => { playReveal(); setRevealed(true); }}
          className="rounded-xl bg-rose-700 text-white font-extrabold px-8 py-3 shadow-lg hover:bg-rose-800 hover:scale-105 transition-all"
        >
          🎁 اكشف الإجابة بعد العصف الذهني
        </button>
      ) : (
        <div className="bg-gradient-to-l from-teal-600 to-teal-700 text-white rounded-2xl p-6 animate-slidein">
          <p className="text-xl font-extrabold leading-relaxed">
            ⭐ إنه الإمام <span className="text-amber-300">تركي بن عبدالله بن محمد بن سعود</span> رحمه الله، الذي أعاد تأسيس الدولة
            السعودية في دورها الثاني عام <span className="text-amber-300">١٢٤٠هـ</span> واتخذ الرياض عاصمة لها.
          </p>
        </div>
      )}
      <div className="mt-6">
        <SpeakButton text="عزيزي الطالب، فكر معي: إذا كانت الدول تقوم على الحق والعدل فإن الله يكتب لها الاستمرارية والبقاء. فعلى الرغم من الدمار الذي لحق بالدولة السعودية الأولى على أيدي الأعداء، فإنه كتب لها الرجوع مرة أخرى. فمن هو مؤسس الدولة السعودية الثانية؟ وكيف تم له ذلك؟ شارك زملاءك بأفكارك." />
      </div>
    </SlideCard>
  );
}

/* ========== الشريحة 3: ماذا حدث بعد سقوط الدرعية - بطاقات مقلوبة ========== */
const AFTERMATH = [
  { icon: "⚔️", text: "قَتْل إمام الدولة والعلماء والفرسان الشجعان الذين دافعوا عن الدرعية." },
  { icon: "🏚️", text: "تدمير المدينة وإخراج من بقي من سكانها." },
  { icon: "🌾", text: "حرق المزارع والمحصولات." },
  { icon: "📚", text: "حرق الكتب والمخطوطات، ونقل بعضها إلى خارج الدرعية." },
  { icon: "🌪️", text: "انتشار الفوضى بسبب غياب الدولة." },
];

export function AftermathSlide() {
  const [flipped, setFlipped] = useState<boolean[]>(Array(AFTERMATH.length).fill(false));
  const allFlipped = flipped.every(Boolean);

  const flip = (i: number) => {
    if (flipped[i]) return;
    playFlip();
    setFlipped((f) => f.map((v, j) => (j === i ? true : v)));
  };

  return (
    <SlideCard>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <SectionTitle icon="❓">ماذا حدث بعد سقوط الدرعية؟</SectionTitle>
        <StrategyBadge name="البطاقات المقلوبة" icon="🃏" />
      </div>
      <p className="text-slate-600 font-semibold mb-6">اضغط على كل بطاقة لتكتشف ما حدث بعد سقوط الدرعية عام ١٢٣٣هـ 👇</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {AFTERMATH.map((item, i) => (
          <button
            key={i}
            onClick={() => flip(i)}
            className={`relative h-44 rounded-2xl transition-all duration-500 [transform-style:preserve-3d] ${
              flipped[i] ? "[transform:rotateY(180deg)]" : "hover:scale-105"
            }`}
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-white flex flex-col items-center justify-center gap-2 shadow-lg [backface-visibility:hidden]">
              <span className="text-4xl">❔</span>
              <span className="font-extrabold text-lg">بطاقة {i + 1}</span>
              <span className="text-teal-100 text-sm">اضغط للكشف</span>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-rose-50 border-2 border-rose-300 flex flex-col items-center justify-center gap-2 p-4 shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <span className="text-3xl">{item.icon}</span>
              <span className="font-bold text-rose-900 text-sm leading-relaxed text-center">{item.text}</span>
            </div>
          </button>
        ))}
        <div className="h-44 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 flex flex-col items-center justify-center p-4 text-center">
          <span className="text-3xl mb-1">{allFlipped ? "🎉" : "⏳"}</span>
          <p className="font-extrabold text-amber-800">
            {allFlipped ? "أحسنت! اكتشفت جميع النتائج الخمس" : `اكتشفت ${flipped.filter(Boolean).length} من ${AFTERMATH.length}`}
          </p>
        </div>
      </div>
      <SpeakButton text="ماذا حدث بعد سقوط الدرعية؟ أولاً: قتل إمام الدولة والعلماء والفرسان الشجعان الذين دافعوا عن الدرعية. ثانياً: تدمير المدينة وإخراج من بقي من سكانها. ثالثاً: حرق المزارع والمحصولات. رابعاً: حرق الكتب والمخطوطات ونقل بعضها إلى خارج الدرعية. خامساً: انتشار الفوضى بسبب غياب الدولة." />
    </SlideCard>
  );
}

/* ========== الشريحة 4: مؤسس جديد يحقق الحلم ========== */
export function FounderSlide() {
  const [highlight, setHighlight] = useState(false);
  return (
    <SlideCard>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <SectionTitle icon="🏅">مؤسس جديد يحقق الحلم بإعادة الدولة السعودية</SectionTitle>
        <StrategyBadge name="القراءة النشطة" icon="📖" />
      </div>
      <div className="grid md:grid-cols-5 gap-6 items-start">
        <div className="md:col-span-3 space-y-4">
          <p className="text-lg leading-loose font-semibold text-slate-800">
            نجا الإمام <span className="bg-amber-200 px-1 rounded font-extrabold">تركي بن عبدالله بن محمد بن سعود</span> من
            الأعداء بعد أن شارك في الدفاع عن الدرعية، وظل يحمل <span className="text-rose-700 font-extrabold">حُلُمَ إعادة تأسيس
            الدولة السعودية</span> ومسؤوليته تجاه ذلك؛ امتداداً لإرث أسرته العريقة.
          </p>
          <p className={`text-lg leading-loose font-semibold text-slate-800 rounded-xl transition-all p-3 ${highlight ? "bg-teal-50 ring-2 ring-teal-400" : ""}`}>
            وبعد <span className="font-extrabold text-teal-700">سبع سنوات فقط</span> من انتهاء الدولة السعودية الأولى، وسقوط
            الدرعية وتدميرها على يد الأعداء، استطاع الإمام تركي بن عبدالله{" "}
            <span className="font-extrabold text-teal-700">استرجاع الدولة، وتأسيس الدولة السعودية الثانية</span>.
          </p>
          <button
            onClick={() => { playClick(); setHighlight(!highlight); }}
            className="rounded-lg bg-amber-100 border border-amber-300 px-4 py-2 font-bold text-amber-800 hover:bg-amber-200 transition-colors text-sm"
          >
            🖍️ {highlight ? "إزالة التظليل" : "ظلّل الفكرة الرئيسة"}
          </button>
        </div>
        <div className="md:col-span-2 bg-teal-50 border-2 border-teal-200 rounded-2xl p-5 space-y-3">
          <h3 className="font-extrabold text-teal-800 text-lg flex items-center gap-2">📌 معلومات سريعة</h3>
          {[
            ["سقوط الدرعية", "١٢٣٣هـ"],
            ["تأسيس الدولة الثانية", "١٢٤٠هـ"],
            ["المدة بينهما", "٧ سنوات فقط"],
            ["العاصمة الجديدة", "الرياض"],
          ].map(([k, v], i) => (
            <div key={i} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 shadow-sm">
              <span className="font-bold text-slate-600 text-sm">{k}</span>
              <span className="font-black text-teal-700">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6">
        <SpeakButton text="مؤسس جديد يحقق الحلم بإعادة الدولة السعودية. نجا الإمام تركي بن عبدالله بن محمد بن سعود من الأعداء بعد أن شارك في الدفاع عن الدرعية، وظل يحمل حلم إعادة تأسيس الدولة السعودية ومسؤوليته تجاه ذلك، امتداداً لإرث أسرته العريقة. وبعد سبع سنوات فقط من انتهاء الدولة السعودية الأولى وسقوط الدرعية وتدميرها على يد الأعداء، استطاع الإمام تركي بن عبدالله استرجاع الدولة وتأسيس الدولة السعودية الثانية." />
      </div>
    </SlideCard>
  );
}
