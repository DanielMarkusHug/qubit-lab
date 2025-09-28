export interface Video {
    id: string;
    title: string;
    description: string;
    topic: "intro" | "deepdive" | "finance" | "strategy" | "stq";
    number: number;       // Video number
    image: string;        // Placeholder JPG
    tags?: string[];      // Tags for filtering, search, display
    links?: { url: string; text: string }[];   // NEW: multiple links per video
  }
  
  export const videos: Video[] = [
    // --- Strategy ---
    {
      id: "o5HPUlc7lCs",
      title: "Q-Day and Post-Quantum Cryptography (PQC)",
      description:
        "Have a look and see why the UK and EU issued regulatory guidance on the PQC in summer 2025. This video is not really about quantum computing and quantum algorithms in finance, but about the impact of quantum computing on current and future cryptography. A lot of half-baked information is going around, so I decided to make a video that explains modern cryptography from scratch — as simple as possible, but not simpler, as usual in my videos.",
      topic: "strategy",
      number: 11,
      image: "Video-11.jpg",
      tags: ["Cryptography", "PQC", "Q-Day", "Regulation", "Business", "Strategy"],
    },
    {
      id: "2hNh-3bSXD0",
      title: "The Quantum Roadmap",
      description:
        "The Business Perspective on Quantum Technology: How to Develop Your Corporate Quantum Roadmap. Quantum is no longer just a research topic — it’s becoming a strategic challenge for industries like finance, pharma, and energy. The real question is: how should companies prepare today for a technology that will mature over the next 10–15 years? The key message: it’s not about counting qubits. It’s about aligning technology evolution with corporate strategy, managing risks early, and building the capability to capture future opportunities.",
      topic: "strategy",
      number: 10,
      image: "Video-10.jpg",
      tags: ["Business", "Roadmap", "Strategy", "PQC", "Q-Day", "Regulation"],
      links: [
        {
          url: "https://qir.mit.edu/wp-content/uploads/2025/06/MIT-QIR-2025.pdf",
          text: "MIT QIR 5/2025",
        },
        {
          url: "https://www.mckinsey.com/~/media/mckinsey/business%20functions/mckinsey%20digital/our%20insights/the%20year%20of%20quantum%20from%20concept%20to%20reality%20in%202025/quantum-monitor-2025.pdf",
          text: "McKinsey Quantum Monitor 6/2025",
        },
      ],
    },
  
    // --- Intro ---
    {
      id: "Ht8jRtI2k5Q",
      title: "Why Quantum Computing Matters",
      description:
        "🌟 Quantum computing is making headlines everywhere — but is it hype or the next big thing? In this video, we go beyond the buzzwords to understand how quantum computers work, how they could disrupt industries like finance, AI, and cryptography, and what programming a quantum computer really looks like.",
      topic: "intro",
      number: 1,
      image: "Video-1.jpg",
      tags: ["Intro", "Basics", "Motivation"],
    },
    {
      id: "kCDn9aTnGB0",
      title: "How Quantum Computers Think",
      description:
        "🧠 Before we code, we need to understand how quantum computers think. We dive into the four cornerstones: qubits, superposition, measurement, entanglement, and quantum gates.",
      topic: "intro",
      number: 2,
      image: "Video-2.jpg",
      tags: ["Intro", "Qubits", "Superposition", "Entanglement"],
    },
    {
      id: "HUZ7C7aAp9w",
      title: "Our First Quantum Program",
      description:
        "🎲 Time to roll the dice — literally! We build our very first quantum circuit: a real eight-sided die powered by quantum randomness. Using Python and Qiskit, we'll create and run a simple but powerful 'Hello, Quantum World!' program.",
      topic: "intro",
      number: 3,
      image: "Video-3.jpg",
      tags: ["Intro", "Qiskit", "Hands-on", "Randomness", "MyFirstCircuit", "Qiskit Coding"],
      links: [
        {
          url: "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%203%20The-Eight-Sided-Die%20(Qiskit-1-version).ipynb",
          text: "Try Qiskit 1 Notebook",
        },
        {
          url: "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%203%20The-Eight-Sided-Die%20(Qiskit-2-version).ipynb",
          text: "Try Qiskit 2 Notebook",
        },
        {
          url: "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%203%20The-Eight-Sided-Die%20(cirq-version)%202.ipynb",
          text: "Try Cirq Notebook",
        },
      ],
    },
  
    // --- Deep Dive ---
    {
      id: "Y5dwYVTI97o",
      title: "Mastering Quantum Gates",
      description:
        "🔧 Ready to build your quantum toolbox? Now that you've seen your first circuit, it's time to learn how quantum gates really work. We revisit vectors and matrices, uncover why quantum gates must be reversible, and explore key players like the X and Hadamard gates.",
      topic: "deepdive",
      number: 4,
      image: "Video-4.jpg",
      tags: ["Deep Dive", "Quantum Gates", "Linear Algebra", "Qiskit Coding"],
      links: [
        {
          url: "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%204%20Deep%20Dive%201%20Quantum%20Gates.ipynb",
          text: "Open Colab Notebook",
        },
        {
          url: "https://youtu.be/XkY2DOUCWMU?si=c8xkJEZK_11zGJ_O",
          text: "Matrix Multiplication (YT Video)",
        },      
      ],
    },
    {
      id: "FDWJ5KgN6Xo",
      title: "Quantum Interference",
      description:
        "🌀 In this video, we explore complex numbers and their phases — the hidden dimension powering quantum computing. Learn how phase shifts enable ✨ quantum interference.",
      topic: "deepdive",
      number: 5,
      image: "Video-5.jpg",
      tags: ["Deep Dive", "Complex Numbers", "Interference", "Qiskit Coding"],
      links: [
        {
          url: "https://youtu.be/T647CGsuOVU?si=Vx38zbHJlMia-A7v",
          text: "Complex Numbers (YT Video)",
        },      
      ],
    },
    {
      id: "LrujTEpfmSk",
      title: "Multi Qubit Systems",
      description:
        "🧠 In this Deep Dive, we scale up to multi-qubit systems and explore entanglement — the third quantum superpower. You’ll see how the tensor product builds 4-state vectors, how CNOT creates Bell states, and why this quickly gets too big for classical computers.",
      topic: "deepdive",
      number: 6,
      image: "Video-6.jpg",
      tags: ["Deep Dive", "Tensor Product", "Entanglement", "Qiskit Coding"],
      links: [
        {
          url: "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%206%20Deep%20Dive%203%20Multi%20Qubit%20Systems.ipynb",
          text: "Open Colab Notebook",
        },
      ],
    },
  
    // --- Finance ---
    {
      id: "WSXt4ODJBkA",
      title: "QAOA Portfolio Optimization",
      description:
        "Explore quantum portfolio optimization: QAOA, real-world finance, and the future beyond classical methods — all explained step by step supported by a Python notebook.",
      topic: "finance",
      number: 7,
      image: "Video-7.jpg",
      tags: ["Finance", "QAOA", "Portfolio Optimization", "Qiskit Coding"],
      links: [
        {
          url: "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%207%20Quantum%20Finance%20QAOA%20Portfolio%20Optimization.ipynb",
          text: "Open Colab Notebook",
        },
      ],
    },
    {
      id: "z8WGPbc66Jk",
      title: "Quantum Monte Carlo for Option Pricing",
      description:
        "Explore how Quantum Monte Carlo with QAE can achieve a quadratic speed-up against classical simulations in pricing financial options — featuring live Python code and real-world insights.",
      topic: "finance",
      number: 8,
      image: "Video-8.jpg",
      tags: ["Finance", "Monte Carlo", "Option Pricing", "Qiskit Coding"],
      links: [
        {
          url: "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%208%20Quantum%20Finance%20Quantum%20Monte%20Carlo%20Option%20Pricing.ipynb",
          text: "Open Colab Notebook",
        },
      ],
    },
    {
      id: "04V2aCHOhh4",
      title: "QML for Fraud Detection",
      description:
        "Discover how Quantum Machine Learning powers fraud detection in finance — see QNNs in action with real transaction data, hands-on Python code, and practical performance analysis. The approach used here is the very same as used by HSBC for their bond trading use case. See also the coverage below. QML is the most promising option today for quantum computing in finance.",
      topic: "finance",
      number: 9,
      image: "Video-9.jpg",
      tags: ["Finance", "QML", "Fraud Detection", "Qiskit Coding"],
      links: [
        {
          url: "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%209%20Quantum%20Finance%20QML%20for%20Fraud%20Detection.ipynb",
          text: "Open Colab Notebook",
        },
        {
          url: "https://www.hsbc.com/news-and-views/news/media-releases/2025/hsbc-demonstrates-worlds-first-known-quantum-enabled-algorithmic-trading-with-ibm",
          text: "HSBC Press Release 25-Sep-2025",
        },
        {
          url: "https://www.google.com/url?sa=t&source=web&rct=j&opi=89978449&url=https://www.bloomberg.com/news/videos/2025-09-25/a-sputnik-moment-hsbc-quantum-computing-breakthrough&ved=2ahUKEwja-5eak_SPAxVRwAIHHe6PE-kQwqsBegQIIRAF&usg=AOvVaw3aa_wMC0WfAvGKYwSR5r-X",
          text: "Bloomberg Podcast on HSBC QML 25-Sept-2025",
        },
      ],
    },

    // --- Straight Talk Quantum ---
    {
      id: "rJocSH89s5E",
      title: "Start Now or Wait 10 Years?",
      description:
        "Should we wait until quantum hardware matures — or already start today with hybrid algorithms? A straight talk on opportunities and risks.",
      topic: "straight talk quantum",
      number: 1,
      image: "STQ-1.jpg",
      tags: ["Straight Talk", "Hybrid Algorithms", "Strategy", "Quantum Today"],
    },

  ];
  