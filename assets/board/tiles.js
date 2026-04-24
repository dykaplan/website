// tiles.js — 20 tiles (5 per side + 4 corners) for the Ivy board.
// Layout: indices 0-19, counter-clockwise from bottom-right corner.
// Corners at 0, 5, 10, 15. Each side has 4 tiles.

window.TILES = [
  // 0: GO corner
  { id: 'go', kind: 'corner', title: 'GO', subtitle: 'Welcome', body: {
    intro: 'Welcome to the board.',
    paragraphs: [
      "I'm Dean Kaplan, a Ph.D. candidate in economics at Boston College. This site is an interactive index of my research, teaching, and background. Click any tile — or switch modes (drive, roll, walk) to explore.",
    ],
    links: [
      { label: 'About', href: '#about' },
      { label: 'Publications', href: 'https://dykaplan.github.io/website/publications/' },
      { label: 'Contact', href: 'mailto:dykaplan@gmail.com' },
    ],
  }},

  // 1-4: Bottom row (right-to-left) — About / Research
  { id: 'about', kind: 'property', group: 'brown', title: 'About Me', subtitle: 'Who I am', body: {
    intro: 'Ph.D. candidate in economics at Boston College.',
    paragraphs: [
      "My research sits at the intersection of applied microeconomics and education policy — how institutions, incentives, and information shape student outcomes.",
      "Before starting my Ph.D., I was a Research Analyst at Harvard's Center for Education Policy Research (CEPR), working on policy evaluations and partnerships with districts and state agencies.",
      "I live in Cambridge, MA.",
    ],
    stats: [
      { k: 'Based',   v: 'Cambridge, MA' },
      { k: 'Field',   v: 'Macro Labor · Structural Labor' },
      { k: 'Program', v: 'Boston College Economics' },
    ],
    links: [
      { label: 'BC profile', href: 'https://www.bc.edu/content/bc-web/schools/morrissey/departments/economics/people/graduate-students/dean-kaplan.html' },
      { label: 'CEPR (Harvard)', href: 'https://cepr.harvard.edu' },
    ],
  }},
  { id: 'research', kind: 'property', group: 'brown', title: 'Research', subtitle: 'Macro & structural labor', body: {
    intro: 'Macro labor economics — how technology and local infrastructure shape wages and employment.',
    paragraphs: [
      "I study labor markets through a structural lens, with a particular interest in how frictions shape the way shocks pass through to wages and employment. Current work explores how new technologies reallocate tasks across workers and occupations, and how that reallocation interacts with the skills people carry between jobs.",
      "A second line of work looks at local infrastructure investments and their downstream effects on wages across sectors. I use quasi-experimental variation and structural methods to separate direct demand effects from broader patterns of regional reallocation.",
    ],
    stats: [
      { k: 'Fields',  v: 'Macro Labor · Structural Labor' },
      { k: 'Methods', v: 'Structural models · IV · DiD' },
    ],
  }},
  { id: 'chance1', kind: 'chance', title: 'Chance', subtitle: 'Random paper', body: {
    intro: 'A rotating spotlight from the reading pile.',
    paragraphs: ["Close this card and click again to draw another."],
  }},
  { id: 'pub', kind: 'property', group: 'cyan', title: 'Publications', subtitle: 'Working papers', body: {
    intro: 'Working papers, published work, and policy reports.',
    paragraphs: [
      "The full, up-to-date list lives on my Publications page — abstracts and PDFs are linked where possible.",
    ],
    links: [{ label: 'Publications page', href: 'https://dykaplan.github.io/website/publications/' }],
  }},

  // 5: Jail corner (bottom-left)
  { id: 'jail', kind: 'corner', title: 'In Progress', subtitle: 'Works in progress', body: {
    intro: 'Not actually in jail — drafts still cooking.',
    paragraphs: [
      "This corner is a catch-all for projects in the messy middle: data collection, early regressions, half-written introductions. They move to Publications once they're ready to read.",
    ],
  }},

  // 6-9: Left column (bottom-to-top) — Teaching / Tools
  { id: 'teaching', kind: 'property', group: 'pink', title: 'Teaching', subtitle: 'TA · Econ', body: {
    intro: 'Teaching assistant for principles and econometrics.',
    paragraphs: [
      "I run problem-solving sections, hold office hours, and write supplementary notes on the topics students find hardest. Notes available on request.",
    ],
    links: [{ label: 'Teaching page', href: 'https://dykaplan.github.io/website/teaching/' }],
  }},
  { id: 'util1', kind: 'utility', title: 'R & Stata', subtitle: 'Daily tools', body: {
    intro: 'Daily analysis stack.',
    paragraphs: [
      "R (tidyverse, fixest) for most applied work; Stata for replication and journals that still want .do files; a little Python for data plumbing.",
    ],
  }},
  { id: 'talks', kind: 'property', group: 'orange', title: 'Talks', subtitle: 'Seminars', body: {
    intro: 'Seminars, conferences, workshops.',
    paragraphs: [
      "Slides and handouts on request. I update them each time I give a talk, so ask for the latest.",
    ],
    links: [{ label: 'Email for slides', href: 'mailto:dykaplan@gmail.com' }],
  }},
  { id: 'rail1', kind: 'rail', title: 'LinkedIn', subtitle: 'Professional', body: {
    intro: 'Best for industry and non-academic correspondence.',
    paragraphs: ["For research questions, email is faster."],
    links: [{ label: 'linkedin.com/in/dean-kaplan', href: 'https://www.linkedin.com/in/dean-kaplan-b4a08739' }],
  }},

  // 10: Free Parking corner (top-left)
  { id: 'free', kind: 'corner', title: 'Free Parking', subtitle: 'Contact', body: {
    intro: 'The easiest place to reach me.',
    paragraphs: [
      "Email is best — I check a few times a day during term. For quick notes, BlueSky works; for durable references, use ORCID.",
    ],
    links: [
      { label: 'Email', href: 'mailto:dykaplan@gmail.com' },
      { label: 'BlueSky', href: 'https://bsky.app/profile/dykap.bsky.social' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/dean-kaplan-b4a08739' },
      { label: 'ORCID', href: 'http://orcid.org/0009-0009-3512-6256' },
    ],
  }},

  // 11-14: Top row (left-to-right) — Code / CV
  { id: 'rail2', kind: 'rail', title: 'GitHub', subtitle: 'Code & data', body: {
    intro: 'Replication code, notes, side projects.',
    paragraphs: [
      "Replication packages are public where licensing allows. Also small data tools and teaching materials.",
    ],
    links: [{ label: 'github.com/dykaplan', href: 'https://github.com/dykaplan' }],
  }},
  { id: 'data', kind: 'property', group: 'red', title: 'Data & Code', subtitle: 'Replication', body: {
    intro: 'Replication packages for papers.',
    paragraphs: [
      "Where licensing permits, I publish replication code (and data) on GitHub. For restricted datasets, I include synthetic test data and clear instructions for running the pipeline against the real files.",
    ],
    links: [{ label: 'GitHub', href: 'https://github.com/dykaplan' }],
  }},
  { id: 'chance2', kind: 'chance', title: 'Chance', subtitle: 'Fun fact', body: {
    intro: 'A small, usually non-economic fact.',
    paragraphs: ["Today's draw: Boston trivia or a recent book. Click again to redraw."],
  }},
  { id: 'cv', kind: 'property', group: 'yellow', title: 'CV', subtitle: 'Education & experience', body: {
    intro: 'Education and experience.',
    paragraphs: [
      "Ph.D. in Economics (in progress), Boston College. Prior: Research Analyst, Harvard CEPR — education policy research and program evaluation in partnership with school districts and state agencies.",
    ],
    stats: [
      { k: 'Ph.D.', v: 'Boston College — in progress' },
      { k: 'Prior', v: 'Harvard CEPR — Research Analyst' },
    ],
    links: [
      { label: 'CEPR', href: 'https://cepr.harvard.edu' },
      { label: 'Email for CV', href: 'mailto:dykaplan@gmail.com' },
    ],
  }},

  // 15: Go to Go corner (top-right)
  { id: 'togo', kind: 'corner', title: 'Go to Go', subtitle: 'Return home', body: {
    intro: 'The shortcut back to GO.',
    paragraphs: ["Nothing else on this tile — just a clean way home."],
  }},

  // 16-19: Right column (top-to-bottom) — ORCID / Notes / Hobbies
  { id: 'orcid', kind: 'property', group: 'green', title: 'ORCID', subtitle: 'Researcher ID', body: {
    intro: 'Persistent researcher identifier.',
    paragraphs: ["If you're citing me or linking my work, ORCID is the stable handle."],
    links: [{ label: '0009-0009-3512-6256', href: 'http://orcid.org/0009-0009-3512-6256' }],
  }},
  { id: 'rail3', kind: 'rail', title: 'BlueSky', subtitle: 'Micro-posts', body: {
    intro: 'Short posts on research and teaching.',
    paragraphs: ["Notes on papers I like, things I'm stuck on, the occasional photo."],
    links: [{ label: '@dykap.bsky.social', href: 'https://bsky.app/profile/dykap.bsky.social' }],
  }},
  { id: 'boston', kind: 'property', group: 'blue', title: 'Boston', subtitle: 'Home base', body: {
    intro: 'Cambridge, MA.',
    paragraphs: ["Boston is home. Afternoons at the BC library, walks to Harvard Square for a change of scenery."],
  }},
  { id: 'lifting', kind: 'property', group: 'blue', title: 'Olympic Weightlifting', subtitle: 'Hobby', body: {
    intro: 'Snatch and clean-and-jerk, on repeat.',
    paragraphs: [
      "A useful counterweight to sitting with a dataset: short sessions, clear feedback, and technique that rewards patience over force.",
    ],
  }},
];
