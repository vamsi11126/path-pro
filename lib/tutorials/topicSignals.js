function normalizeText(value) {
  return String(value || '').trim()
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))]
}

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'what',
  'why',
  'that',
  'the',
  'their',
  'this',
  'to',
  'learn',
  'using',
  'with'
])

const LOW_SIGNAL_ANCHOR_TERMS = new Set([
  'detailed',
  'detail',
  'look',
  'focusing',
  'focus',
  'relevant',
  'structure',
  'structures',
  'function',
  'functions',
  'role',
  'roles',
  'development',
  'importance',
  'topic',
  'concept',
  'concepts',
  'basics',
  'introduction',
  'overview',
  'fundamentals',
  'principles',
  'system',
  'systems',
  'process',
  'processes',
  'mechanism',
  'mechanisms'
])

function extractTopicTokens(...values) {
  return unique(
    values
      .map(normalizeText)
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]+/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
      .slice(0, 12)
  )
}

function termAppearsInsideTitle(term, topicTitle = '') {
  const normalizedTerm = normalizeText(term).toLowerCase()
  const normalizedTitle = normalizeText(topicTitle).toLowerCase()
  return Boolean(normalizedTerm && normalizedTitle && normalizedTitle.includes(normalizedTerm))
}

export function isLowSignalAnchorTerm(term = '', topicTitle = '') {
  const normalized = normalizeText(term).toLowerCase()
  if (!normalized) return true
  if (LOW_SIGNAL_ANCHOR_TERMS.has(normalized)) return true
  if (normalized === normalizeText(topicTitle).toLowerCase()) return true
  if (normalized.length < 4 && !/\d/.test(normalized)) return true
  return false
}

export function selectHighSignalAnchorTerms(context = {}, options = {}) {
  const limit = Math.max(1, Number(options.limit) || 3)
  const profile = options.profile || buildTopicSignalProfile(context)
  const topicTitle = normalizeText(context.topicTitle)
  const candidates = unique(Array.isArray(profile?.anchorTerms) ? profile.anchorTerms : [])

  const ranked = candidates
    .map((term, index) => {
      const normalized = normalizeText(term)
      const lower = normalized.toLowerCase()
      let score = 0

      if (!normalized) return null

      if (!isLowSignalAnchorTerm(normalized, topicTitle)) {
        score += 4
      }
      if (!termAppearsInsideTitle(normalized, topicTitle)) {
        score += 4
      }
      if (/\s/.test(normalized)) {
        score += 2
      }
      if (normalized.length >= 8) {
        score += 1
      }
      if (lower === normalizeText(topicTitle).toLowerCase()) {
        score -= 6
      }

      return { term: normalized, lower, score, index }
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.index - right.index
    })

  const selected = []

  for (const candidate of ranked) {
    if (selected.length >= limit) break

    const overlapsExisting = selected.some((existing) =>
      existing.toLowerCase() === candidate.lower
      || existing.toLowerCase().includes(candidate.lower)
    )

    if (!overlapsExisting) {
      selected.push(candidate.term)
    }
  }

  if (selected.length < limit) {
    for (const candidate of candidates) {
      const normalized = normalizeText(candidate)
      if (!normalized || selected.includes(normalized)) {
        continue
      }
      selected.push(normalized)
      if (selected.length >= limit) {
        break
      }
    }
  }

  return selected.slice(0, limit)
}

function buildAnchorLabels(topicTitle, topicDescription, subjectTitle) {
  const tokens = extractTopicTokens(topicTitle, topicDescription, subjectTitle)
  const [primary, secondary, tertiary] = tokens

  return {
    tokens,
    primary: primary || 'core structure',
    secondary: secondary || 'signal pathway',
    tertiary: tertiary || 'measured response'
  }
}

function buildGenericProfile({ topicTitle, topicDescription, subjectTitle }) {
  const topic = normalizeText(topicTitle) || 'this topic'
  const subject = normalizeText(subjectTitle) || 'the subject'
  const description = normalizeText(topicDescription) || `${topic} matters because it changes what you can explain, inspect, or apply.`
  const anchors = buildAnchorLabels(topicTitle, topicDescription, subjectTitle)

  return {
    domainId: 'generic',
    domainLabel: 'general concept learning',
    anchorTerms: unique(anchors.tokens),
    plainDefinition: `${topic} is a topic in ${subject} that you understand best by naming the real parts involved, the change that happens between them, and the outcome you can observe.`,
    whyItMatters: description || `${topic} matters because it changes what you can explain, inspect, or apply in ${subject}.`,
    concreteElements: [
      `how ${anchors.primary} shapes the behavior of ${topic}`,
      `where ${anchors.secondary} changes, transfers, or coordinates activity inside ${topic}`,
      `which measurable response or constraint tells you ${topic} is working in ${subject}`
    ],
    processSteps: [
      `Identify the active components that make ${topic} possible in ${subject}, especially ${anchors.primary} and ${anchors.secondary}.`,
      `Trace how information, material, force, or control moves through ${topic} instead of stopping at a definition.`,
      `Check the response, failure mode, or measurable result that proves ${topic} is behaving the way the explanation claims.`
    ],
    observationSignals: [
      `You can point to a concrete signal, response, or constraint that follows from ${topic}.`,
      `You can explain why ${anchors.secondary} matters instead of repeating the label of the topic.`,
      `You can judge whether an example of ${topic} is realistic, oversimplified, or missing a critical interface.`
    ],
    misconceptions: [
      `Treating ${topic} like a vocabulary term instead of a working system with inspectable parts.`,
      `Describing ${topic} without naming what ${anchors.primary} is interacting with or affecting.`,
      'Using examples with no measurable signal, constraint, or observable outcome.'
    ],
    handsOnActions: [
      `Sketch the pathway, interface, or control loop in ${topic} and label where ${anchors.primary} and ${anchors.secondary} appear.`,
      `Predict what changes first if one part of ${topic} is perturbed, blocked, accelerated, or redesigned.`,
      `Name the measurement, response, or failure signal you would inspect to confirm your explanation of ${topic}.`
    ],
    analogy: `Think of ${topic} like a live control surface rather than a static diagram: one layer senses, another layer responds, and the quality of the interface determines whether the full system behaves smoothly or breaks down.`,
    scenario: {
      setup: `A serious learner in ${subject} has to explain ${topic} to a design or research team that needs a usable mental model, not textbook filler.`,
      tasks: [
        `Name the critical parts, layers, or interfaces that make ${topic} work.`,
        `Walk through the operating chain in order, including what ${anchors.secondary} changes or controls.`,
        'Predict one measurable response, visible consequence, or design constraint that follows from the explanation.',
        'Diagnose one oversimplification or engineering mistake that would make the explanation unreliable.'
      ],
      successSignal: `The explanation sounds specific enough that a researcher, engineer, or reviewer could test, critique, or build on it.`
    },
    compareBoard: {
      title: `High-signal lenses for ${topic}`,
      headers: ['Lens', 'What to inspect', 'Why it matters'],
      rows: [
        [anchors.primary, `Map where ${anchors.primary} sits inside ${topic} and what it touches, senses, or supports`, 'This grounds the lesson in a real structure instead of a label.'],
        [anchors.secondary, `Track how ${anchors.secondary} changes, transmits, or coordinates behavior across the interface`, 'This explains the operating logic rather than just the definition.'],
        ['Measured response', `Inspect the signal, output, failure mode, or performance cue that changes when ${topic} works`, 'This turns the concept into something testable and design-relevant.']
      ]
    },
    glossaryRows: [
      [anchors.primary, `A high-value structure, component, or layer inside ${topic} that you must name explicitly.`],
      [anchors.secondary, `The signal, transfer path, or control move that makes ${topic} dynamic instead of static.`],
      ['Measured response', `The output, constraint, or performance cue that proves your explanation has predictive value.`]
    ],
    capabilityChecklist: [
      `I can identify the crucial structures or layers inside ${topic} without defaulting to generic wording.`,
      `I can explain how ${anchors.secondary} changes or coordinates behavior inside ${topic}.`,
      `I can predict a measurable response, design implication, or failure signal for a concrete example of ${topic}.`,
      `I can critique a weak explanation of ${topic} and replace it with a more testable one.`
    ],
    workedExample: `Take one concrete example of ${topic} in ${subject}. Identify the real components involved, trace how they interact or exchange information, then end with the response, constraint, or performance signal you would inspect to verify the explanation.`
  }
}

function buildJavaScriptProfile({ topicTitle, topicDescription, subjectTitle }) {
  const topic = normalizeText(topicTitle) || 'JavaScript'
  const description = normalizeText(topicDescription)
  const subject = normalizeText(subjectTitle) || 'web development'

  return {
    domainId: 'javascript_fundamentals',
    domainLabel: 'JavaScript fundamentals and web development',
    anchorTerms: [
      'javascript',
      'browser',
      'runtime',
      'dom',
      'events',
      'functions',
      'variables',
      'api',
      'node.js',
      'interactive web pages'
    ],
    plainDefinition: 'JavaScript is a programming language that lets web pages and applications respond to user actions, update content, work with data, and automate logic in the browser or on the server.',
    whyItMatters: description || 'You learn JavaScript because it is one of the core languages of the web. It is the tool that turns a page from static content into something interactive, and it is also widely used for backend services, tooling, and app development.',
    concreteElements: [
      'JavaScript code made of variables, functions, and logic',
      'the runtime that executes the code, such as a browser tab or Node.js',
      'events, user input, timers, or API responses that trigger the code',
      'the DOM or application state that changes after the code runs'
    ],
    processSteps: [
      'Start with the plain-English definition: JavaScript is the programming language that gives web pages and apps behavior, logic, and interactivity.',
      'Trace the mechanism: the runtime loads the script, waits for events or data, runs functions, and then updates the page, application state, or another system output.',
      'Check the observable result: buttons react, forms validate, content updates without a full reload, data is fetched, or a script automates work that would otherwise stay static.'
    ],
    observationSignals: [
      'A page changes in response to a click, keypress, form submission, timer, or fetched data.',
      'The same language can be used across frontend behavior, backend logic with Node.js, and developer tooling.',
      'A learner can explain not just that JavaScript is "for websites", but exactly how it connects code, events, data, and visible behavior.'
    ],
    misconceptions: [
      'Treating JavaScript like a vocabulary label for "web stuff" instead of a language that runs logic in a runtime.',
      'Confusing JavaScript with Java, even though they are different languages with different ecosystems.',
      'Saying JavaScript only adds animations, while ignoring data handling, APIs, backend work, and application logic.'
    ],
    handsOnActions: [
      'Take a simple webpage action, such as clicking a button, and name the event, the JavaScript function, and the visible DOM update.',
      'Compare a static HTML page with a page that uses JavaScript to validate a form or fetch data.',
      'Explain one example where JavaScript runs in the browser and one where it runs in Node.js.'
    ],
    analogy: 'Think of HTML as the structure of a stage, CSS as the styling and lighting, and JavaScript as the stage crew following cues in real time. When something happens, JavaScript decides what should move, change, appear, or respond next.',
    scenario: {
      setup: `A product or design team in ${subject} needs a quick, accurate explanation of why JavaScript is central to modern web apps instead of hearing another vague answer like "it makes websites dynamic."`,
      tasks: [
        'Define JavaScript in one plain-English sentence.',
        'Name the runtime, the event or input, and the part of the page or app that changes.',
        'Give one concrete example such as form validation, a to-do list update, or fetching data for a dashboard.',
        'Correct one weak explanation, such as saying JavaScript only adds visual effects.'
      ],
      successSignal: 'The explanation is specific enough that a teammate can tell where JavaScript runs, what triggers it, and what visible result it causes.'
    },
    compareBoard: {
      title: `Core moving parts in ${topic}`,
      headers: ['Part', 'What to inspect', 'Why it matters'],
      rows: [
        ['JavaScript code', 'Variables, functions, conditions, and event handlers', 'This is the logic layer that decides what the app should do.'],
        ['Runtime and events', 'Browser or Node.js, plus clicks, input, timers, or API responses', 'This explains when the code runs and what wakes it up.'],
        ['Visible outcome', 'DOM updates, validated input, fetched data, or changed state', 'This proves the code is doing useful work instead of sitting idle.']
      ]
    },
    glossaryRows: [
      ['Runtime', 'The environment that executes JavaScript, such as a browser or Node.js.'],
      ['DOM', 'The document object model, which is the page structure JavaScript can read and update.'],
      ['Event', 'A signal such as a click, submit, input change, or timer that tells JavaScript to run code.'],
      ['Function', 'A reusable block of JavaScript logic that performs a task when called.']
    ],
    capabilityChecklist: [
      'I can explain JavaScript as a programming language, not just as a buzzword for web interactivity.',
      'I can name the runtime, trigger, and visible result in a JavaScript example.',
      'I can give at least one browser example and one Node.js example.',
      'I can correct the misconception that JavaScript is only for visual effects or that it is the same thing as Java.'
    ],
    workedExample: 'Example: a user clicks a "Show price" button on an ecommerce page. JavaScript listens for the click event, runs a function, fetches pricing data or reads it from state, and updates the DOM so the user sees the result immediately without reloading the page.'
  }
}

function buildBioengineeringInterfaceProfile({ topicTitle, topicDescription, subjectTitle }) {
  const topic = normalizeText(topicTitle) || 'Cell Biology and Engineering Interfaces'
  const description = normalizeText(topicDescription)
  const subject = normalizeText(subjectTitle) || 'Biology for Engineering'

  return {
    domainId: 'bioengineering_interfaces',
    domainLabel: 'bioengineering and cellular interfaces',
    plainDefinition: 'A bioengineering interface is the contact zone where a cell or tissue meets an engineered material, scaffold, or device, and where signals from that interface shape biological behavior.',
    whyItMatters: description || `This matters in ${subject} because the interface determines whether cells attach, survive, signal correctly, and produce the biological response the design is supposed to create.`,
    anchorTerms: [
      'cell membrane',
      'receptor',
      'ligand',
      'extracellular matrix',
      'scaffold',
      'biocompatibility',
      'signal transduction',
      'adhesion',
      'mechanotransduction',
      'microenvironment'
    ],
    concreteElements: [
      'the cell membrane and receptor systems that sense the outside world',
      'the engineered surface, scaffold, device, or biomaterial touching the cell',
      'the biochemical or mechanical signal that travels across the interface',
      'the measurable cell response such as adhesion, migration, differentiation, or viability'
    ],
    processSteps: [
      'Identify which cellular structures meet the engineered interface, such as receptors, adhesion proteins, or the membrane surface.',
      'Trace how the interface changes the local microenvironment through chemistry, topography, stiffness, flow, or signaling cues.',
      'Explain how the cell converts that interface cue into a biological response through adhesion, signaling, mechanotransduction, or gene-expression changes.'
    ],
    observationSignals: [
      'Cells attach, spread, or detach differently depending on surface chemistry and adhesion cues.',
      'A scaffold or device changes signaling behavior by altering ligand exposure, stiffness, or transport conditions.',
      'The engineering success signal is measurable: viability, morphology, marker expression, migration, or controlled response.'
    ],
    misconceptions: [
      'Treating the interface like a passive boundary when it actively shapes signaling and behavior.',
      'Talking about cell response without naming the material, receptor, or mechanical cue driving it.',
      'Ignoring measurement, which makes the explanation sound scientific without being testable.'
    ],
    handsOnActions: [
      'Label the biological side, the engineered side, and the signal crossing the interface in one concrete setup.',
      'Predict how a change in stiffness, ligand density, or scaffold geometry would alter cell behavior.',
      'Choose one measurable readout such as adhesion, viability, morphology, or marker expression and explain why it proves the interface is working.'
    ],
    analogy: 'Think of a cell-engineering interface like a smart docking surface, not a passive wall. The engineered side presents cues, the cell reads them through membrane machinery, and the quality of that conversation determines whether the biological system cooperates, adapts, or fails.',
    scenario: {
      setup: description || `A bioengineering team is designing a scaffold in ${subject} and needs to explain how cells will sense, attach to, and respond to the engineered interface before moving into experiments.`,
      tasks: [
        'Name the biological structures and engineered features that meet at the interface.',
        'Explain how one cue such as stiffness, ligand density, or surface chemistry changes cell signaling.',
        'Predict a measurable cell response the team should expect if the interface is working.',
        'Identify one flawed assumption that would make the design explanation biologically weak.'
      ],
      successSignal: 'The learner can connect material properties, cell sensing, and measurable biological outcomes in one coherent engineering explanation.'
    },
    compareBoard: {
      title: `Interface layers inside ${topic}`,
      headers: ['Layer', 'What to inspect', 'Why it matters'],
      rows: [
        ['Cell sensing layer', 'Inspect receptors, adhesion proteins, and membrane behavior at the contact zone', 'This explains how the cell actually reads the engineered surface.'],
        ['Engineered interface', 'Inspect material chemistry, stiffness, topography, or scaffold geometry', 'These are the knobs engineers tune to change cellular behavior.'],
        ['Biological response', 'Inspect adhesion, morphology, signaling, viability, or differentiation markers', 'These outcomes show whether the interface design is producing the intended effect.']
      ]
    },
    glossaryRows: [
      ['Biocompatibility', 'How safely and effectively a material or device interacts with living cells or tissue.'],
      ['Mechanotransduction', 'How cells convert physical cues such as stiffness or force into biological signaling.'],
      ['Extracellular matrix', 'The structural and biochemical environment that cells anchor to and interpret.'],
      ['Signal transduction', 'The chain of molecular events that turns an external cue into a cellular response.']
    ],
    capabilityChecklist: [
      'I can explain how cells sense an engineered surface instead of calling it a passive contact point.',
      'I can connect one engineering variable to one cellular signaling consequence.',
      'I can predict a measurable biological response to an interface design choice.',
      'I can critique whether a bioengineering explanation is specific enough to test experimentally.'
    ],
    workedExample: 'Example: a tissue-engineering scaffold is coated with adhesion ligands and tuned for moderate stiffness. Cells contact the scaffold through membrane receptors, build adhesion complexes, and trigger signaling pathways that influence spreading and differentiation. If the interface is well designed, the measurable outcomes include stronger attachment, healthier morphology, and marker-expression changes aligned with the intended tissue response.'
  }
}

function buildBiomoleculesProfile({ topicTitle, topicDescription, subjectTitle }) {
  const topic = normalizeText(topicTitle) || 'Biomolecules'
  const description = normalizeText(topicDescription)
  const subject = normalizeText(subjectTitle) || 'Biology'

  return {
    domainId: 'biology_biomolecules',
    domainLabel: 'biological macromolecules',
    plainDefinition: 'Biomolecules are the major classes of molecules that build cells, store information, provide energy, and carry out the chemical work of life.',
    whyItMatters: description || `This matters in ${subject} because understanding biomolecules lets you explain how cells store information, build structure, use energy, and run essential reactions.`,
    anchorTerms: [
      'proteins',
      'nucleic acids',
      'carbohydrates',
      'lipids',
      'amino acids',
      'nucleotides',
      'monosaccharides',
      'fatty acids',
      'enzymes',
      'dna',
      'rna',
      'cell membrane'
    ],
    concreteElements: [
      'proteins as enzymes, structural components, transporters, and signaling molecules',
      'nucleic acids such as DNA and RNA storing and transferring genetic information',
      'carbohydrates providing rapid energy and structural support',
      'lipids storing energy and forming cell membranes'
    ],
    processSteps: [
      'Classify the biomolecule first: carbohydrate, lipid, protein, or nucleic acid.',
      'Link each class to its building blocks, such as monosaccharides, fatty acids, amino acids, or nucleotides.',
      'Explain how structure drives function, such as enzymes catalyzing reactions, phospholipids forming membranes, or DNA storing information.'
    ],
    observationSignals: [
      'If the example is about catalysis, transport, or structural support, proteins are usually central.',
      'If the example is about heredity, coding, or information flow, nucleic acids are the key biomolecules.',
      'If the example is about quick energy, storage, or membrane formation, carbohydrates and lipids are the comparison to make.'
    ],
    misconceptions: [
      'Treating all biomolecules like one category instead of distinguishing their structures and jobs.',
      'Listing proteins, carbohydrates, lipids, and nucleic acids without explaining what each one actually does.',
      'Forgetting that structure matters: the monomers and chemical properties help explain the function.'
    ],
    handsOnActions: [
      'Take one biological example and decide which biomolecule class is doing the most important work.',
      'Match each biomolecule class to its building block and its main function.',
      'Predict what would fail if a protein, nucleic acid, carbohydrate, or lipid were missing from the system.'
    ],
    analogy: 'Think of biomolecules like the four main teams that keep a cell running: carbohydrates are the quick-fuel supply, lipids build barriers and long-term storage, proteins do most of the active work, and nucleic acids store and relay the instructions.',
    scenario: {
      setup: description || `A learner in ${subject} has to explain why proteins, carbohydrates, lipids, and nucleic acids are grouped together as biomolecules while still having very different jobs in living systems.`,
      tasks: [
        'Name the four major biomolecule classes explicitly.',
        'Match each class to a concrete function or example in the cell.',
        'Explain one way structure helps determine function for one biomolecule class.',
        'Correct one oversimplified explanation, such as saying all biomolecules just "give energy".'
      ],
      successSignal: 'The learner can distinguish the four major biomolecule classes, connect each to function, and explain why those differences matter biologically.'
    },
    compareBoard: {
      title: `Functional roles inside ${topic}`,
      headers: ['Biomolecule class', 'What to look for', 'Why it matters'],
      rows: [
        ['Proteins', 'Enzymes, transporters, receptors, and structural fibers built from amino acids', 'Proteins do most of the active chemical and mechanical work in cells.'],
        ['Nucleic acids', 'DNA, RNA, nucleotides, and information transfer', 'They store, transmit, and help express genetic information.'],
        ['Carbohydrates and lipids', 'Sugars, polysaccharides, fatty acids, phospholipids, and membrane roles', 'They are central to energy handling, storage, and cellular structure.']
      ]
    },
    glossaryRows: [
      ['Proteins', 'Polymers of amino acids that act as enzymes, structural elements, transporters, and signaling molecules.'],
      ['Nucleic acids', 'DNA and RNA, which store and transmit genetic information using nucleotides.'],
      ['Carbohydrates', 'Sugars and polysaccharides used for energy supply, energy storage, and some structural functions.'],
      ['Lipids', 'Hydrophobic molecules used for membrane structure, long-term energy storage, and signaling.']
    ],
    capabilityChecklist: [
      'I can name the four major biomolecule classes without mixing up their roles.',
      'I can connect proteins, nucleic acids, carbohydrates, and lipids to concrete cellular functions.',
      'I can explain how structure helps determine biomolecule function.',
      'I can correct shallow explanations that only list the classes without explaining them.'
    ],
    workedExample: 'Example: in a cell, enzymes that speed up reactions are proteins, the membrane is built largely from lipids, stored and quick-access energy often involves carbohydrates, and DNA or RNA handles the genetic instructions that guide cellular activity.'
  }
}

function buildMacEthernetProfile({ topicTitle, topicDescription }) {
  const topic = normalizeText(topicTitle) || 'MAC Addresses and Ethernet'
  const description = normalizeText(topicDescription)

  return {
    domainId: 'networking_mac_ethernet',
    domainLabel: 'Ethernet networking',
    plainDefinition: 'A MAC address is a link-layer identifier used for local delivery on an Ethernet network, and Ethernet is the local networking system that carries frames between devices on the same LAN.',
    whyItMatters: description || 'This matters because you need MAC addresses and Ethernet behavior to explain how switches forward traffic across a local network before routing ever enters the picture.',
    anchorTerms: [
      'mac address',
      'ethernet',
      'ethernet frame',
      'source mac',
      'destination mac',
      'switch',
      'port',
      'forwarding table',
      'broadcast',
      'flooding'
    ],
    concreteElements: [
      'the source MAC and destination MAC fields in an Ethernet frame',
      'the switch port where the frame enters',
      'the MAC forwarding table entry that maps a device to a port',
      'the decision to forward on one port or flood across multiple ports'
    ],
    processSteps: [
      'Read the source MAC and destination MAC from the Ethernet frame header.',
      'Use the ingress port and source MAC to learn or refresh the switch forwarding table.',
      'Check whether the destination MAC is known; if it is, forward on one port, otherwise flood the frame to other ports in the VLAN.'
    ],
    observationSignals: [
      'The switch learns the sender MAC on the ingress port.',
      'A known destination MAC produces a single forwarding decision instead of flooding.',
      'An unknown destination MAC causes flooding until the switch learns where that device lives.'
    ],
    misconceptions: [
      'Confusing a MAC address with an IP address; MAC works at the link layer inside the local network, while IP is used for routing between networks.',
      'Assuming Ethernet always broadcasts frames; a switch forwards unicast traffic to one learned port when it can.',
      'Thinking the switch learns from the destination MAC first; it learns from the source MAC on incoming frames.'
    ],
    handsOnActions: [
      'Label the source MAC, destination MAC, ingress port, and expected egress port on a sample Ethernet frame.',
      'Predict whether the switch will forward or flood before checking the MAC table.',
      'Simulate a first frame from a new device and note how the switch learns the sender MAC.'
    ],
    analogy: 'Think of a MAC address like a room number inside one building. The Ethernet frame is the delivery envelope, and the switch is the mailroom clerk who learns which room number lives behind which hallway door so future deliveries go straight to the right place.',
    scenario: {
      setup: description || 'A laptop sends an Ethernet frame to a printer on the same LAN through a switch. The switch already knows the printer MAC on port 7, and the laptop frame arrives on port 3.',
      tasks: [
        'Identify the source MAC, destination MAC, and ingress port in the frame.',
        'Explain what the switch learns from the arriving frame.',
        'Predict which port the frame leaves from and whether flooding happens.',
        'Name one mistake a learner might make, such as mixing up MAC and IP addressing.'
      ],
      successSignal: 'The explanation points to frame fields, switch-table entries, and port behavior instead of vague networking language.'
    },
    compareBoard: {
      title: `Manipulate the real Ethernet parts inside ${topic}`,
      headers: ['Part', 'What you inspect or manipulate', 'What result you should expect'],
      rows: [
        ['Source MAC address', 'Read which device sent the frame and which ingress port it came from', 'The switch can learn or refresh a MAC-to-port mapping.'],
        ['Destination MAC address', 'Check whether the destination is already in the switch table', 'Known destinations forward on one port; unknown ones flood.'],
        ['Ethernet frame header', 'Inspect the source and destination fields before guessing the path', 'You can justify the forwarding decision from the frame itself.'],
        ['Switch forwarding table', 'Match MAC addresses to learned ports', 'You can predict the egress port or explain why flooding occurs.']
      ]
    },
    glossaryRows: [
      ['MAC address', 'A link-layer hardware identifier used for local delivery on an Ethernet network.'],
      ['Ethernet frame', 'The data unit that carries source and destination MAC addresses across a LAN.'],
      ['Switch forwarding table', 'The table a switch builds to remember which MAC addresses live on which ports.'],
      ['Flooding', 'Sending a frame out multiple ports when the destination MAC is unknown.']
    ],
    capabilityChecklist: [
      'I can identify source and destination MAC addresses in an Ethernet frame.',
      'I can explain how a switch learns a MAC-to-port mapping from incoming traffic.',
      'I can predict when a frame is forwarded on one port versus flooded.',
      'I can distinguish MAC addressing from IP addressing without mixing the layers.'
    ],
    workedExample: 'Example: a laptop on port 3 sends a frame to a printer on port 7. Read the source and destination MAC addresses in the Ethernet frame. The switch learns the laptop MAC on port 3 from the source field, looks up the printer MAC, finds port 7, and forwards the frame only there. If the printer MAC were unknown, the switch would flood the frame to the other ports in the VLAN.'
  }
}

function buildGeneralNetworkingProfile(context) {
  const generic = buildGenericProfile(context)

  return {
    ...generic,
    domainId: 'networking_general',
    domainLabel: 'computer networking',
    anchorTerms: unique([
      ...generic.anchorTerms,
      'packet',
      'frame',
      'switch',
      'router',
      'port',
      'network'
    ]),
    handsOnActions: [
      'Trace how the data unit moves from sender to receiver.',
      'Name which device or protocol makes the decision at each step.',
      'Predict what visible network behavior would confirm the explanation.'
    ],
    analogy: 'Think of the network like a delivery system where each device makes a different routing or forwarding decision based on the information it can see.'
  }
}

export function buildTopicSignalProfile(context = {}) {
  const combined = [
    context.subjectTitle,
    context.subjectDescription,
    context.subjectSyllabus,
    context.topicTitle,
    context.topicDescription
  ].map(normalizeText).join(' ').toLowerCase()

  if (
    /\bjavascript\b/.test(combined)
    || /\bjava script\b/.test(combined)
    || /\bnode\.?js\b/.test(combined)
    || /\bdom\b/.test(combined)
    || /\bweb development\b/.test(combined)
    || /\bfrontend\b/.test(combined)
  ) {
    return buildJavaScriptProfile(context)
  }

  if (/\bmac address(es)?\b/.test(combined) || /\bethernet\b/.test(combined)) {
    return buildMacEthernetProfile(context)
  }

  if (
    /\bcell biology\b/.test(combined)
    || (/\bcell\b/.test(combined) && /\bengineering\b/.test(combined))
    || (/\binterface(s)?\b/.test(combined) && /\bbiology\b/.test(combined))
    || /\bbiomaterial\b|\bscaffold\b|\bbiocompatib/i.test(combined)
  ) {
    return buildBioengineeringInterfaceProfile(context)
  }

  if (
    /\bbiomolecule(s)?\b/.test(combined)
    || /\bbiological macromolecule(s)?\b/.test(combined)
    || /\bmacromolecule(s)?\b/.test(combined)
    || (/\bprotein(s)?\b/.test(combined) && /\bcarbohydrate(s)?\b/.test(combined) && /\blipid(s)?\b/.test(combined))
    || (/\bnucleic acid(s)?\b/.test(combined) && /\bprotein(s)?\b/.test(combined))
  ) {
    return buildBiomoleculesProfile(context)
  }

  if (/\bnetwork(ing)?\b|\bpacket\b|\bframe\b|\bswitch\b|\brouter\b|\bport\b/.test(combined)) {
    return buildGeneralNetworkingProfile(context)
  }

  return buildGenericProfile(context)
}

function joinBullets(items = []) {
  return items.map((item) => `- ${item}`).join('\n')
}

export function buildTopicSpecificityGuidance(context = {}) {
  const profile = buildTopicSignalProfile(context)
  const compareRows = (profile.compareBoard?.rows || [])
    .map((row) => row.filter(Boolean).join(' | '))
    .slice(0, 3)
    .join('\n')

  return [
    `Topic-specific teaching anchors for this lesson:`,
    `- Domain focus: ${profile.domainLabel}.`,
    profile.anchorTerms.length > 0
      ? `- Prefer these concrete terms when they fit the topic: ${profile.anchorTerms.join(', ')}.`
      : '- Use topic-native nouns and named parts instead of generic placeholders.',
    `- Concrete elements to teach: ${profile.concreteElements.join('; ')}.`,
    `- Process steps to make visible: ${profile.processSteps.join(' ')}`,
    `- Observable outcomes or checks: ${profile.observationSignals.join(' ')}`,
    `- Misconceptions worth correcting: ${profile.misconceptions.join(' ')}`,
    `- Hands-on or applied moves: ${profile.handsOnActions.join(' ')}`,
    `- Scenario shape: ${profile.scenario.setup}`,
    compareRows ? `- Example compare-board rows:\n${joinBullets(compareRows.split('\n'))}` : '',
    '- Do not write artifact templates with empty buckets like "state the setup" or "what you begin with" unless they are filled with concrete topic parts.'
  ].filter(Boolean).join('\n')
}

export function countAnchorMentions(text = '', anchorTerms = []) {
  const normalized = normalizeText(text).toLowerCase()
  return anchorTerms.reduce((count, term) => {
    const pattern = new RegExp(`\\b${escapeRegExp(term.toLowerCase())}\\b`, 'g')
    const matches = normalized.match(pattern)
    return count + (matches ? matches.length : 0)
  }, 0)
}
