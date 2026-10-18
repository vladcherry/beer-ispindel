/* styles.js — справочник стилей: код BJCP 2021, цвет, короткое описание на четырёх языках
   и советы по брожению для каждого типа дрожжей. Диапазоны (температура, плотность, алкоголь)
   живут в analysis.js, здесь только тексты. */
const StyleGuide = (() => {
  // id: [код BJCP, цвет (pale | amber | dark), { en, ru, uk, es }]
  const INFO = {
    'american-pale-ale': ['18B', 'pale', {
      en: 'A bright, refreshing ale led by American hops: citrus, pine and flowers over a light malt backbone, finishing dry.',
      ru: 'Светлый освежающий эль с американским хмелем: цитрус, сосна, цветы на лёгкой солодовой основе, сухое послевкусие.',
      uk: 'Світлий освіжаючий ель з американським хмелем: цитрус, сосна, квіти на легкій солодовій основі, сухий післясмак.',
      es: 'Ale clara y refrescante dominada por lúpulos americanos: cítricos, pino y flores sobre una base maltosa ligera y final seco.' }],
    'american-ipa': ['21A', 'pale', {
      en: 'A hop-forward pale ale: strong citrus, tropical or resinous hop aroma, firm bitterness, clean and dry.',
      ru: 'Хмелевой светлый эль: яркий аромат цитруса, тропиков или смолы, выраженная горечь, чистый и сухой.',
      uk: 'Хмельовий світлий ель: яскравий аромат цитруса, тропіків чи смоли, виразна гірчинка, чистий і сухий.',
      es: 'Ale clara centrada en el lúpulo: aroma intenso a cítricos, frutas tropicales o resina, amargor firme, limpia y seca.' }],
    'double-ipa': ['22A', 'pale', {
      en: 'A stronger, more intense IPA: lots of hops, high alcohol hidden behind a dry finish.',
      ru: 'Более крепкий и насыщенный IPA: очень много хмеля, высокий алкоголь прячется за сухим финишем.',
      uk: 'Міцніший і насиченіший IPA: дуже багато хмелю, високий алкоголь ховається за сухим фінішем.',
      es: 'IPA más fuerte e intensa: mucho lúpulo y alcohol elevado escondido tras un final seco.' }],
    'hazy-ipa': ['21C', 'pale', {
      en: 'A soft, hazy IPA with juicy tropical and stone-fruit hop aroma, low bitterness and a creamy body.',
      ru: 'Мягкий мутный IPA с сочным ароматом тропических фруктов и косточковых, низкой горечью и кремовым телом.',
      uk: 'М’який мутний IPA з соковитим ароматом тропічних і кісточкових фруктів, низькою гірчинкою та кремовим тілом.',
      es: 'IPA suave y turbia con aroma jugoso a fruta tropical y de hueso, amargor bajo y cuerpo cremoso.' }],
    'english-ipa': ['12C', 'amber', {
      en: 'A hoppy English ale with earthy, floral English hops, bready malt and noticeable bitterness.',
      ru: 'Хмелевой английский эль: землистый и цветочный английский хмель, хлебный солод и заметная горечь.',
      uk: 'Хмельовий англійський ель: землистий і квітковий англійський хміль, хлібний солод і помітна гірчинка.',
      es: 'Ale inglesa lupulada con lúpulos ingleses terrosos y florales, malta a pan y amargor marcado.' }],
    'best-bitter': ['11B', 'amber', {
      en: 'A sessionable English pub ale: balanced biscuit malt and earthy hops, low carbonation.',
      ru: 'Лёгкий английский пабный эль: баланс бисквитного солода и землистого хмеля, низкая газация.',
      uk: 'Легкий англійський пабний ель: баланс бісквітного солоду та землистого хмелю, низька газація.',
      es: 'Ale de pub inglesa ligera: equilibrio entre malta a galleta y lúpulo terroso, carbonatación baja.' }],
    'irish-red': ['15A', 'amber', {
      en: 'An easy-drinking amber ale with caramel and toast, a hint of roast and a dry finish.',
      ru: 'Лёгкий янтарный эль с карамелью и поджаристостью, лёгкой обжаркой и сухим финишем.',
      uk: 'Легкий бурштиновий ель з карамеллю й підсмаженістю, легкою обсмаженістю та сухим фінішем.',
      es: 'Ale ámbar fácil de beber con caramelo y tostado, un toque torrefacto y final seco.' }],
    'irish-stout': ['15B', 'dark', {
      en: 'A black, dry stout with roasted barley, coffee notes and a creamy head, surprisingly light.',
      ru: 'Чёрный сухой стаут с жжёным ячменём, нотами кофе и кремовой пеной, неожиданно лёгкий.',
      uk: 'Чорний сухий стаут з паленим ячменем, нотами кави та кремовою піною, несподівано легкий.',
      es: 'Stout negra y seca con cebada tostada, notas de café y espuma cremosa, sorprendentemente ligera.' }],
    'oatmeal-stout': ['16B', 'dark', {
      en: 'A smooth, full stout: oats give a silky body to coffee and chocolate flavours.',
      ru: 'Мягкий плотный стаут: овёс даёт шелковистое тело к вкусу кофе и шоколада.',
      uk: 'М’який щільний стаут: овес дає шовковисте тіло до смаку кави та шоколаду.',
      es: 'Stout suave y con cuerpo: la avena aporta sedosidad al café y el chocolate.' }],
    'imperial-stout': ['20C', 'dark', {
      en: 'A big, rich stout: roast, chocolate, dark fruit and warming alcohol; ages well.',
      ru: 'Мощный насыщенный стаут: обжарка, шоколад, тёмные фрукты и согревающий алкоголь; хорошо выдерживается.',
      uk: 'Потужний насичений стаут: обсмаження, шоколад, темні фрукти й зігрівальний алкоголь; добре витримується.',
      es: 'Stout grande y rica: tostado, chocolate, fruta oscura y alcohol cálido; envejece bien.' }],
    'porter': ['20A', 'dark', {
      en: 'A dark ale with chocolate and caramel, gentle roast and a medium body.',
      ru: 'Тёмный эль с шоколадом и карамелью, мягкой обжаркой и средним телом.',
      uk: 'Темний ель з шоколадом і карамеллю, м’яким обсмаженням і середнім тілом.',
      es: 'Ale oscura con chocolate y caramelo, tostado suave y cuerpo medio.' }],
    'baltic-porter': ['9C', 'dark', {
      en: 'A strong, smooth dark lager: dark fruit, chocolate and caramel, clean lager finish.',
      ru: 'Крепкий мягкий тёмный лагер: тёмные фрукты, шоколад и карамель, чистый лагерный финиш.',
      uk: 'Міцний м’який темний лагер: темні фрукти, шоколад і карамель, чистий лагерний фініш.',
      es: 'Lager oscura, fuerte y suave: fruta oscura, chocolate y caramelo con final limpio de lager.' }],
    'brown-ale': ['19C', 'dark', {
      en: 'A malty brown ale with caramel, nuts and chocolate, balanced by moderate hops.',
      ru: 'Солодовый коричневый эль с карамелью, орехами и шоколадом, уравновешенный умеренным хмелем.',
      uk: 'Солодовий коричневий ель з карамеллю, горіхами й шоколадом, урівноважений помірним хмелем.',
      es: 'Ale marrón maltosa con caramelo, frutos secos y chocolate, equilibrada con lúpulo moderado.' }],
    'scottish-ale': ['14B', 'amber', {
      en: 'A malt-focused Scottish ale: caramel and toffee, very low hops, clean and soft.',
      ru: 'Солодовый шотландский эль: карамель и ириска, очень мало хмеля, чистый и мягкий.',
      uk: 'Солодовий шотландський ель: карамель та ірис, дуже мало хмелю, чистий і м’який.',
      es: 'Ale escocesa centrada en la malta: caramelo y toffee, muy poco lúpulo, limpia y suave.' }],
    'barleywine': ['17D', 'amber', {
      en: 'A very strong ale: rich malt, caramel and dried fruit, warming alcohol; needs long ageing.',
      ru: 'Очень крепкий эль: насыщенный солод, карамель и сухофрукты, согревающий алкоголь; требует долгой выдержки.',
      uk: 'Дуже міцний ель: насичений солод, карамель і сухофрукти, зігрівальний алкоголь; потребує довгої витримки.',
      es: 'Ale muy fuerte: malta rica, caramelo y fruta seca, alcohol cálido; necesita una larga guarda.' }],
    'hefeweizen': ['10A', 'pale', {
      en: 'A cloudy German wheat beer with banana and clove from the yeast, fluffy and highly carbonated.',
      ru: 'Мутное немецкое пшеничное с бананом и гвоздикой от дрожжей, пышное и сильно газированное.',
      uk: 'Мутне німецьке пшеничне з бананом і гвоздикою від дріжджів, пишне й сильно газоване.',
      es: 'Cerveza de trigo alemana turbia con plátano y clavo de la levadura, espumosa y muy carbonatada.' }],
    'dunkelweizen': ['10B', 'dark', {
      en: 'A dark wheat beer: banana and clove plus bread crust, caramel and a touch of chocolate.',
      ru: 'Тёмное пшеничное: банан и гвоздика плюс хлебная корочка, карамель и немного шоколада.',
      uk: 'Темне пшеничне: банан і гвоздика плюс хлібна скоринка, карамель і трохи шоколаду.',
      es: 'Trigo oscura: plátano y clavo con corteza de pan, caramelo y un toque de chocolate.' }],
    'witbier': ['24A', 'pale', {
      en: 'A hazy Belgian wheat beer spiced with coriander and orange peel, light and tart.',
      ru: 'Мутное бельгийское пшеничное с кориандром и апельсиновой цедрой, лёгкое и с кислинкой.',
      uk: 'Мутне бельгійське пшеничне з коріандром і апельсиновою цедрою, легке й з кислинкою.',
      es: 'Cerveza de trigo belga turbia con cilantro y piel de naranja, ligera y algo ácida.' }],
    'saison': ['25B', 'pale', {
      en: 'A dry, spicy and fruity Belgian farmhouse ale with lively carbonation; the yeast loves heat.',
      ru: 'Сухой пряно-фруктовый бельгийский фермерский эль с живой газацией; дрожжи любят тепло.',
      uk: 'Сухий пряно-фруктовий бельгійський фермерський ель з живою газацією; дріжджі люблять тепло.',
      es: 'Ale de granja belga seca, especiada y afrutada, con carbonatación viva; la levadura ama el calor.' }],
    'belgian-blonde': ['25A', 'pale', {
      en: 'A golden Belgian ale: soft malt sweetness, fruity and spicy yeast, hidden strength.',
      ru: 'Золотистый бельгийский эль: мягкая солодовая сладость, фруктово-пряные дрожжи, скрытая крепость.',
      uk: 'Золотистий бельгійський ель: м’яка солодова солодкість, фруктово-пряні дріжджі, прихована міцність.',
      es: 'Ale belga dorada: dulzor suave de malta, levadura afrutada y especiada, fuerza oculta.' }],
    'belgian-dubbel': ['26B', 'dark', {
      en: 'A dark abbey ale: dried fruit, caramel and dark sugar with spicy Belgian yeast.',
      ru: 'Тёмный аббатский эль: сухофрукты, карамель и тёмный сахар с пряными бельгийскими дрожжами.',
      uk: 'Темний абатський ель: сухофрукти, карамель і темний цукор з пряними бельгійськими дріжджами.',
      es: 'Ale de abadía oscura: fruta seca, caramelo y azúcar oscuro con levadura belga especiada.' }],
    'belgian-tripel': ['26C', 'pale', {
      en: 'A strong golden abbey ale: dry, spicy and fruity, very drinkable for its strength.',
      ru: 'Крепкий золотистый аббатский эль: сухой, пряный и фруктовый, очень питкий для своей крепости.',
      uk: 'Міцний золотистий абатський ель: сухий, пряний і фруктовий, дуже питкий як на свою міцність.',
      es: 'Ale de abadía dorada y fuerte: seca, especiada y afrutada, muy bebible para su graduación.' }],
    'belgian-quad': ['26D', 'dark', {
      en: 'A big dark Belgian ale: plum, raisin, caramel and warming alcohol.',
      ru: 'Мощный тёмный бельгийский эль: слива, изюм, карамель и согревающий алкоголь.',
      uk: 'Потужний темний бельгійський ель: слива, родзинки, карамель і зігрівальний алкоголь.',
      es: 'Ale belga oscura y grande: ciruela, pasas, caramelo y alcohol cálido.' }],
    'kolsch': ['5B', 'pale', {
      en: 'A delicate pale ale from Cologne: crisp like a lager, with a hint of fruit.',
      ru: 'Деликатный светлый эль из Кёльна: чистый, как лагер, с лёгкой фруктовостью.',
      uk: 'Делікатний світлий ель з Кельна: чистий, як лагер, з легкою фруктовістю.',
      es: 'Ale clara y delicada de Colonia: limpia como una lager, con un toque afrutado.' }],
    'altbier': ['7B', 'amber', {
      en: 'An amber Düsseldorf ale fermented cool: malty, bitter and clean.',
      ru: 'Янтарный эль из Дюссельдорфа, бродит в прохладе: солодовый, горький и чистый.',
      uk: 'Бурштиновий ель з Дюссельдорфа, бродить у прохолоді: солодовий, гіркий і чистий.',
      es: 'Ale ámbar de Düsseldorf fermentada en frío: maltosa, amarga y limpia.' }],
    'cream-ale': ['1C', 'pale', {
      en: 'A light, crisp American ale, often with corn: refreshing and easy.',
      ru: 'Лёгкий чистый американский эль, часто с кукурузой: освежающий и простой.',
      uk: 'Легкий чистий американський ель, часто з кукурудзою: освіжаючий і простий.',
      es: 'Ale americana ligera y limpia, a menudo con maíz: refrescante y fácil.' }],
    'german-pils': ['5D', 'pale', {
      en: 'A crisp, dry German lager with a firm bitterness and floral, herbal hops.',
      ru: 'Чистый сухой немецкий лагер с выраженной горечью и цветочно-травяным хмелем.',
      uk: 'Чистий сухий німецький лагер з виразною гірчинкою та квітково-трав’яним хмелем.',
      es: 'Lager alemana limpia y seca con amargor firme y lúpulo floral y herbal.' }],
    'czech-pilsner': ['3B', 'pale', {
      en: 'A rich golden lager with bready malt, spicy Saaz hops and a soft bitterness.',
      ru: 'Насыщенный золотистый лагер с хлебным солодом, пряным жатецким хмелем и мягкой горечью.',
      uk: 'Насичений золотистий лагер з хлібним солодом, пряним жатецьким хмелем і м’якою гірчинкою.',
      es: 'Lager dorada y rica con malta a pan, lúpulo Saaz especiado y amargor suave.' }],
    'helles': ['4A', 'pale', {
      en: 'A soft, malty Munich lager: bread and honey notes, gentle hops, very clean.',
      ru: 'Мягкий солодовый мюнхенский лагер: хлеб и мёд, деликатный хмель, очень чистый.',
      uk: 'М’який солодовий мюнхенський лагер: хліб і мед, делікатний хміль, дуже чистий.',
      es: 'Lager muniquesa suave y maltosa: pan y miel, lúpulo discreto, muy limpia.' }],
    'marzen': ['6A', 'amber', {
      en: 'An amber festival lager: toasty malt, clean and smooth, dry finish.',
      ru: 'Янтарный праздничный лагер: поджаристый солод, чистый и мягкий, сухой финиш.',
      uk: 'Бурштиновий святковий лагер: підсмажений солод, чистий і м’який, сухий фініш.',
      es: 'Lager de fiesta ámbar: malta tostada, limpia y suave, final seco.' }],
    'vienna-lager': ['7A', 'amber', {
      en: 'A copper lager with a light toasty malt character and a crisp finish.',
      ru: 'Медный лагер с лёгким поджаристым солодовым характером и чистым финишем.',
      uk: 'Мідний лагер з легким підсмаженим солодовим характером і чистим фінішем.',
      es: 'Lager cobriza con carácter de malta ligeramente tostada y final limpio.' }],
    'schwarzbier': ['8B', 'dark', {
      en: 'A black lager that drinks light: soft roast and chocolate without heaviness.',
      ru: 'Чёрный лагер, который пьётся легко: мягкая обжарка и шоколад без тяжести.',
      uk: 'Чорний лагер, що п’ється легко: м’яке обсмаження й шоколад без важкості.',
      es: 'Lager negra que se bebe ligera: tostado suave y chocolate sin pesadez.' }],
    'bock': ['6C', 'dark', {
      en: 'A strong malty lager: toasted bread, caramel and a smooth, clean finish.',
      ru: 'Крепкий солодовый лагер: поджаренный хлеб, карамель и мягкий чистый финиш.',
      uk: 'Міцний солодовий лагер: підсмажений хліб, карамель і м’який чистий фініш.',
      es: 'Lager fuerte y maltosa: pan tostado, caramelo y final suave y limpio.' }],
    'doppelbock': ['9A', 'dark', {
      en: 'A very strong, rich lager: intense malt, dark fruit and caramel, little bitterness.',
      ru: 'Очень крепкий насыщенный лагер: интенсивный солод, тёмные фрукты и карамель, мало горечи.',
      uk: 'Дуже міцний насичений лагер: інтенсивний солод, темні фрукти й карамель, мало гірчинки.',
      es: 'Lager muy fuerte y rica: malta intensa, fruta oscura y caramelo, poco amargor.' }],
    'american-lager': ['1B', 'pale', {
      en: 'A very light, crisp and cold-drinking lager with little flavour beyond freshness.',
      ru: 'Очень лёгкий чистый лагер для холодного питья, вкус прежде всего свежий.',
      uk: 'Дуже легкий чистий лагер для холодного пиття, смак передусім свіжий.',
      es: 'Lager muy ligera y limpia para beber fría, de sabor sobre todo fresco.' }],
    'berliner-weisse': ['23A', 'pale', {
      en: 'A very light, sour wheat beer, sharp and refreshing, often served with syrup.',
      ru: 'Очень лёгкое кислое пшеничное, резкое и освежающее, часто подают с сиропом.',
      uk: 'Дуже легке кисле пшеничне, різке й освіжаюче, часто подають із сиропом.',
      es: 'Trigo ácida muy ligera, punzante y refrescante, a menudo servida con jarabe.' }],
    'cider': ['C1A', 'pale', {
      en: 'Fermented apple juice: from bone dry to off-dry, fresh apple and a clean finish.',
      ru: 'Сброженный яблочный сок: от совсем сухого до полусухого, свежее яблоко и чистый финиш.',
      uk: 'Зброджений яблучний сік: від зовсім сухого до напівсухого, свіже яблуко й чистий фініш.',
      es: 'Zumo de manzana fermentado: de muy seco a semiseco, manzana fresca y final limpio.' }],
  };

  // Советы по брожению для типа дрожжей
  const TIPS = {
    ale: {
      en: ['Typical yeast: US-05, S-04, WLP001.', 'Keep the temperature steady for the first 3 days — fewer esters.', 'After the main fermentation give it 2–3 days 1–2 °C warmer, then cold-condition.'],
      ru: ['Типичные дрожжи: US-05, S-04, WLP001.', 'Держи температуру ровной первые 3 дня — будет меньше эфиров.', 'После основного брожения 2–3 дня на 1–2 °C теплее, потом холодное дозревание.'],
      uk: ['Типові дріжджі: US-05, S-04, WLP001.', 'Тримай температуру рівною перші 3 дні — буде менше ефірів.', 'Після основного бродіння 2–3 дні на 1–2 °C тепліше, потім холодне дозрівання.'],
      es: ['Levadura típica: US-05, S-04, WLP001.', 'Mantén la temperatura estable los 3 primeros días: menos ésteres.', 'Tras la fermentación principal, 2–3 días 1–2 °C más cálida y luego guarda en frío.'] },
    lager: {
      en: ['Yeast: W-34/70, S-23, WLP830 — pitch 1.5–2× more than for an ale.', 'Near the end do a diacetyl rest at 16–18 °C for 2–3 days.', 'Then lager at about 0–2 °C for 3–6 weeks.'],
      ru: ['Дрожжи: W-34/70, S-23, WLP830 — задавай в 1,5–2 раза больше, чем для эля.', 'Под конец — диацетиловая пауза 16–18 °C на 2–3 дня.', 'Потом лагерирование около 0–2 °C 3–6 недель.'],
      uk: ['Дріжджі: W-34/70, S-23, WLP830 — задавай у 1,5–2 рази більше, ніж для еля.', 'Наприкінці — діацетилова пауза 16–18 °C на 2–3 дні.', 'Потім лагерування близько 0–2 °C 3–6 тижнів.'],
      es: ['Levadura: W-34/70, S-23, WLP830; inocula 1,5–2 veces más que para una ale.', 'Al final, reposo de diacetilo a 16–18 °C durante 2–3 días.', 'Después, guarda a unos 0–2 °C durante 3–6 semanas.'] },
    wheat: {
      en: ['Yeast: WB-06, WLP300 — they give banana and clove.', 'Warmer (20–22 °C) means more banana, cooler (18 °C) more clove.', 'Drink it young: 2–4 weeks after packaging.'],
      ru: ['Дрожжи: WB-06, WLP300 — дают банан и гвоздику.', 'Теплее (20–22 °C) — больше банана, прохладнее (18 °C) — больше гвоздики.', 'Пей молодым: 2–4 недели после розлива.'],
      uk: ['Дріжджі: WB-06, WLP300 — дають банан і гвоздику.', 'Тепліше (20–22 °C) — більше банана, прохолодніше (18 °C) — більше гвоздики.', 'Пий молодим: 2–4 тижні після розливу.'],
      es: ['Levadura: WB-06, WLP300; aportan plátano y clavo.', 'Más cálida (20–22 °C), más plátano; más fresca (18 °C), más clavo.', 'Bébela joven: 2–4 semanas tras embotellar.'] },
    belgian: {
      en: ['Belgian yeast likes warmth: start low and let it rise by 2–4 °C.', 'High gravity — pitch more yeast and aerate the wort well.', 'Usually bottle-conditioned to high carbonation.'],
      ru: ['Бельгийские дрожжи любят тепло: начни ниже и дай температуре подняться на 2–4 °C.', 'Высокая плотность — задавай больше дрожжей и хорошо аэрируй сусло.', 'Обычно дображивают в бутылках до высокой газации.'],
      uk: ['Бельгійські дріжджі люблять тепло: почни нижче й дай температурі піднятися на 2–4 °C.', 'Висока густина — задавай більше дріжджів і добре аеруй сусло.', 'Зазвичай доброджують у пляшках до високої газації.'],
      es: ['La levadura belga ama el calor: empieza bajo y deja subir 2–4 °C.', 'Densidad alta: inocula más levadura y oxigena bien el mosto.', 'Suele refermentar en botella con carbonatación alta.'] },
    hybrid: {
      en: ['Ale yeast fermented cool or lager yeast fermented warm — a clean profile.', 'Stay in the lower part of the range.', 'Cold-condition for 2–4 weeks for a clear beer.'],
      ru: ['Эль-дрожжи в прохладе или лагерные в тепле — чистый профиль.', 'Держись нижней части диапазона.', 'Холодное дозревание 2–4 недели сделает пиво прозрачным.'],
      uk: ['Ель-дріжджі в прохолоді або лагерні в теплі — чистий профіль.', 'Тримайся нижньої частини діапазону.', 'Холодне дозрівання 2–4 тижні зробить пиво прозорим.'],
      es: ['Levadura ale en frío o lager en calor: perfil limpio.', 'Quédate en la parte baja del rango.', 'Guarda en frío 2–4 semanas para una cerveza clara.'] },
    sour: {
      en: ['You need lactobacillus: kettle sour before the boil, or pitch it with the yeast.', 'Keep separate equipment — bacteria can infect other batches.', 'Target pH 3.2–3.5.'],
      ru: ['Нужны лактобактерии: кеттл-сауэр до кипячения или вместе с дрожжами.', 'Держи отдельный инвентарь — бактерии заразят другие партии.', 'Целевой pH 3,2–3,5.'],
      uk: ['Потрібні лактобактерії: кетл-сауер до кип’ятіння або разом із дріжджами.', 'Тримай окремий інвентар — бактерії заразять інші партії.', 'Цільовий pH 3,2–3,5.'],
      es: ['Necesitas lactobacilos: kettle sour antes del hervor o junto a la levadura.', 'Usa equipo aparte: las bacterias pueden contaminar otros lotes.', 'pH objetivo 3,2–3,5.'] },
    cider: {
      en: ['Cider or champagne yeast (EC-1118); wild fermentation also works.', 'Add yeast nutrient — juice is low in nitrogen.', 'Ferments to dry; sweeten with non-fermentable sweeteners.'],
      ru: ['Сидровые или шампанские дрожжи (EC-1118); можно дикое брожение.', 'Добавь подкормку для дрожжей — в соке мало азота.', 'Бродит до сухого; для сладости — несбраживаемые подсластители.'],
      uk: ['Сидрові або шампанські дріжджі (EC-1118); можна дике бродіння.', 'Додай підживлення для дріжджів — у соку мало азоту.', 'Бродить до сухого; для солодкості — незброджувані підсолоджувачі.'],
      es: ['Levadura de sidra o champán (EC-1118); también fermentación salvaje.', 'Añade nutriente: el zumo tiene poco nitrógeno.', 'Fermenta hasta seco; endulza con edulcorantes no fermentables.'] },
  };

  const code = (id) => (INFO[id] || [])[0] || '';
  const colour = (id) => (INFO[id] || [])[1] || 'pale';
  const desc = (id, lang) => { const d = (INFO[id] || [])[2]; return d ? d[lang] || d.en : ''; };
  const tips = (yeast, lang) => { const x = TIPS[yeast]; return x ? x[lang] || x.en : []; };
  // Фильтры справочника: по типу дрожжей и отдельно «тёмные»
  const CATEGORIES = ['all', 'ale', 'lager', 'wheat', 'belgian', 'dark', 'other'];
  function inCategory(style, cat) {
    if (cat === 'all') return true;
    if (cat === 'dark') return colour(style.id) === 'dark';
    if (cat === 'other') return ['hybrid', 'sour', 'cider'].includes(style.yeast);
    return style.yeast === cat;
  }
  // Ссылки: поиск в Википедии на языке интерфейса (всегда открывается) и поиск на сайте BJCP.
  const WIKI = { en: 'en', ru: 'ru', uk: 'uk', es: 'es' };
  const wikiUrl = (name, lang) => `https://${WIKI[lang] || 'en'}.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`;
  const bjcpUrl = (enName) => `https://www.bjcp.org/?s=${encodeURIComponent(enName)}`;

  return { code, colour, desc, tips, CATEGORIES, inCategory, wikiUrl, bjcpUrl };
})();
