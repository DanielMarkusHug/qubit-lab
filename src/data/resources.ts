export interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  image: string; // small logo or icon
  tags: string[];
}

export const resources: Resource[] = [
  {
    id: "mit-quantum-report-2025",
    title: "MIT Quantum Index Report 2025",
    description:
      "MIT’s Quantum Index Report 2025 provides a comprehensive overview of global research, technology roadmaps, and investment trends in quantum computing.",
    url: "https://qir.mit.edu/wp-content/uploads/2025/06/MIT-QIR-2025.pdf",
    image: "QIR2025.jpg",
    tags: ["Strategy", "Report", "Business"],
  },
  {
    id: "mckinsey-quantum-monitor-2025",
    title: "McKinsey Quantum Technology Monitor 2025",
    description:
      "McKinsey’s 2025 Quantum Monitor analyzes corporate adoption, use cases, and strategic challenges for industries preparing for quantum advantage.",
    url: "https://www.mckinsey.com/~/media/mckinsey/business%20functions/mckinsey%20digital/our%20insights/the%20year%20of%20quantum%20from%20concept%20to%20reality%20in%202025/quantum-monitor-2025.pdf",
    image: "QTM2025.jpg",
    tags: ["Strategy", "Report", "Business"],
  },
  {
    id: "gqi-report-2025",
    title: "Global Quantum Intelligence Report 2025",
    description:
      "Global Quantum Intelligence (GQI) report, highlighting major developments in quantum technology and industry trends.",
    url: "https://quantumcomputingreport.com",
    image: "QCReport.jpg",
    tags: ["Strategy", "Report", "Business"],
  },
  {
    id: "quantum-computing-report-education",
    title: "Quantum Computing Report – Education",
    description:
      "The education section of Quantum Computing Report, providing curated resources, tutorials, and references for learning quantum computing.",
    url: "https://quantumcomputingreport.com/education/",
    image: "QCReportEdu.jpg",
    tags: ["Learning"],
  },
  {
    id: "quirk",
    title: "Quirk",
    description:
      "An interactive drag-and-drop quantum circuit simulator in the browser. Great for quick visual experimentation with gates and circuits.",
    url: "https://algassert.com/quirk",
    image: "QUIRK.jpg",
    tags: ["Coding", "Simulator", "Learning"],
  },
  {
    id: "cirq",
    title: "Cirq",
    description:
      "Google’s open-source framework for programming quantum circuits in Python, with a focus on NISQ-era devices.",
    url: "https://quantumai.google/cirq",
    image: "cirq.jpg",
    tags: ["Cirq", "Coding", "Python"],
  },
  {
    id: "cirq-tutorial",
    title: "Cirq Tutorial",
    description:
      "Hands-on tutorial for learning Cirq, including building circuits, running simulations, and exploring quantum algorithms.",
    url: "https://quantumai.google/cirq/tutorials",
    image: "cirqtut.jpg",
    tags: ["Cirq", "Coding", "Learning", "Python"],
  },
  {
    id: "matrix-multiplication-video",
    title: "Matrix Multiplication for Beginners",
    description:
      "A simple video introduction to matrix multiplication, one of the key mathematical tools behind quantum gates and circuits.",
    url: "https://youtu.be/XkY2DOUCWMU?si=c8xkJEZK_11zGJ_O",
    image: "Matrixvideo.jpg",
    tags: ["Math Basics", "Video", "Linear Algebra", "Matrices"],
  },
  {
    id: "complex-numbers-video",
    title: "Complex Numbers for Beginners",
    description:
      "Video explainer of complex numbers, important to understand phases, rotations and quantum interference.",
    url: "https://youtu.be/T647CGsuOVU?si=Vx38zbHJlMia-A7v",
    image: "complexvideo.jpg",
    tags: ["Math Basics", "Video", "Complex Numbers"],
  },
  {
    id: "qiskit-tutorials",
    title: "Qiskit Tutorials",
    description:
      "Official IBM Qiskit tutorials covering circuits, algorithms, simulators, and real devices. A hands-on way to learn quantum programming step by step.",
    url: "https://quantum.cloud.ibm.com/docs/tutorials",
    image: "qiskit.png",
    tags: ["Qiskit", "Coding", "Learning", "Python"],
  },
  {
    id: "qiskit-community-tutorials",
    title: "Qiskit Community Tutorials",
    description:
      "A GitHub repository of community-contributed notebooks exploring Qiskit for algorithms, games, finance, and machine learning.",
    url: "https://github.com/qiskit-community/qiskit-community-tutorials",
    image: "qiskit.png",
    tags: ["Qiskit", "Coding", "Community", "Python"],
  },
];
