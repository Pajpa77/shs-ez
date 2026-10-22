export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const YOUTH_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'Was bedeutet es, wenn ein Rettungshund "Hochwind" wittert?',
    options: [
      'Er riecht menschliche Geruchspartikel, die vom Wind durch die Luft getragen werden (Flächensuche).',
      'Er spürt, dass bald ein Gewitter aufzieht.',
      'Er schaut nach Vögeln am Himmel.',
    ],
    correctIndex: 0,
    explanation:
      'Genau! Bei der Flächensuche nutzt der Hund den Hochwind, um menschliche Witterung in der Luft schnell aufzuspüren.',
  },
  {
    id: 'q2',
    question: 'Was ist der Unterschied zwischen einem Flächensuchhund und einem Mantrailer?',
    options: [
      'Mantrailer suchen nur im tiefen Wasser.',
      'Flächensuchhunde suchen jeden Menschen im Wald; Mantrailer folgen dem Individualgeruch einer bestimmten Person.',
      'Es gibt gar keinen Unterschied.',
    ],
    correctIndex: 1,
    explanation:
      'Richtig! Ein Mantrailer riecht an einem Kleidungsstück und folgt genau dieser Spur, während der Flächensuchhund ein ganzes Gebiet absucht.',
  },
  {
    id: 'q3',
    question: 'Was tust du als Erstes, wenn du im Suchsektor ein Fundstück oder die Übungspuppe entdeckst?',
    options: [
      'Stehen bleiben, Fundstelle nicht verändern und sofort per Funk oder App an die Leitung melden.',
      'Das Fundstück schnell einstecken und weiterrennen.',
      'Den Fund geheim halten, um mehr Punkte zu bekommen.',
    ],
    correctIndex: 0,
    explanation:
      'Sehr gut! Wichtig ist: Fundstelle sichern, nicht zertrampeln und der Übungsleitung sofort Bescheid geben.',
  },
  {
    id: 'q4',
    question: 'Warum ist die Belohnung (Leckerli, Futtertube oder Spieli) nach der Suche so wichtig?',
    options: [
      'Weil der Hund sonst keinen Hunger hat.',
      'Weil Suchen für den Hund das tollste Spiel ist und positive Bestätigung ihn motiviert.',
      'Damit der Hund einschläft.',
    ],
    correctIndex: 1,
    explanation:
      'Klasse! Für den Rettungshund ist die Suche ein riesiges Spiel, bei dem am Ende die beste Party der Welt gefeiert wird!',
  },
  {
    id: 'q5',
    question: 'Wofür steht die Abkürzung "EZ" in unserem Verein?',
    options: [
      'Einsatzzentrale',
      'Erste-Hilfe-Zelt',
      'Einsatz-Zone',
    ],
    correctIndex: 0,
    explanation:
      'Richtig! Die Einsatzzentrale (EZ) ist das Herzstück: Hier laufen alle Fäden, Karten und Funksprüche zusammen.',
  },
  {
    id: 'q6',
    question: 'Was machst du, wenn du dich im Wald unsicher fühlst oder nicht mehr weißt, wo du bist?',
    options: [
      'Einfach tiefer in den Wald hineinlaufen.',
      'Stehen bleiben, Ruhe bewahren, die Leitung anfunken oder den SOS-Notfall-Button drücken.',
      'Das Smartphone ausschalten.',
    ],
    correctIndex: 1,
    explanation:
      'Perfekt! Wer stehen bleibt, wird am schnellsten wiedergefunden. Die Leitung sieht deinen GPS-Punkt sofort.',
  },
  {
    id: 'q7',
    question: 'Warum nimmt die Jugendgruppe nur an Übungen und nicht an Realeinsätzen teil?',
    options: [
      'Weil Realeinsätze erst ab 18 Jahren und nach bestandener Einsatzprüfung erlaubt sind.',
      'Weil die Hunde nachts schlafen müssen.',
      'Weil die Einsatzzentrale zu klein ist.',
    ],
    correctIndex: 0,
    explanation:
      'Ganz genau! Schutz und Sicherheit stehen an erster Stelle. Bis zum 18. Geburtstag lernen und trainieren wir fleißig in der Jugendgruppe.',
  },
  {
    id: 'q8',
    question: 'Welches Kommando ruft man oft vor dem Beginn einer Suchübung über Funk aus?',
    options: [
      'Such und Hilf!',
      'Guten Appetit!',
      'Feierabend für heute!',
    ],
    correctIndex: 0,
    explanation:
      '„Such und Hilf!“ ist das traditionelle Leitwort vieler Rettungshundeführer.',
  },
];
