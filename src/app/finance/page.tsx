"use client";

import { videos } from "@/data/videos";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";
import VideoGrid from "@/components/VideoGrid";
import TeaserCard from "@/components/TeaserCard";

type FinanceModel = {
  title: string;
  businessProblem: string;
  data: string;
  quantumMethod: string;
  videoNumber: number;
  codeHref: string;
};

const financeModels: FinanceModel[] = [
  {
    title: "Portfolio Optimization",
    businessProblem:
      "Select a Sharpe-ratio-oriented portfolio of up to 10 assets under budget constraints.",
    data: "Real day-end prices from mid-2024 to mid-2025 via yfinance.",
    quantumMethod: "QUBO / QAOA",
    videoNumber: 7,
    codeHref:
      "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%207%20Quantum%20Finance%20QAOA%20Portfolio%20Optimization.ipynb",
  },
  {
    title: "Credit Card Fraud Detection",
    businessProblem:
      "Detect fraudulent card transactions from labeled payment data.",
    data:
      "Real Mastercard transaction data, PCA-preprocessed, used in a popular Kaggle competition.",
    quantumMethod: "VQC (Variational Quantum Classifier) / feature mapping",
    videoNumber: 9,
    codeHref:
      "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%209%20Quantum%20Finance%20QML%20for%20Fraud%20Detection.ipynb",
  },
  {
    title: "Derivative Pricing",
    businessProblem:
      "Estimate derivative prices with Monte Carlo-based methods and quantum acceleration concepts.",
    data: "Market-based option inputs and simulated payoff paths.",
    quantumMethod: "Quantum Monte Carlo / Amplitude Estimation",
    videoNumber: 8,
    codeHref:
      "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%208%20Quantum%20Finance%20Quantum%20Monte%20Carlo%20Option%20Pricing.ipynb",
  },
  {
    title: "Classification of Market Stress Regimes (S&P 500)",
    businessProblem:
      "Classify market stress regimes from equity and volatility signals.",
    data:
      "Real day-end prices of the S&P 500, implied volatility, and derived indicators.",
    quantumMethod: "Quantum classification / hybrid layers / quantum-classical comparison",
    videoNumber: 12,
    codeHref:
      "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%2012%20Quantum%20Finance%20QML%202%20-%20classical%20vs%20quantum.ipynb",
  },
];

function FinanceModelsTable() {
  return (
    <section className="mt-12 mb-12">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Applied Quantum Finance Models
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-300">
          Selected finance-focused quantum models combining real or market-based
          data, executable code, and short video explainers.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-950">
        <table className="w-full min-w-[980px] text-left">
          <thead className="bg-neutral-900">
            <tr className="border-b border-neutral-800">
              <th className="px-5 py-4 text-sm font-semibold text-neutral-100">
                Model
              </th>
              <th className="px-5 py-4 text-sm font-semibold text-neutral-100">
                Business Problem
              </th>
              <th className="px-5 py-4 text-sm font-semibold text-neutral-100">
                Data
              </th>
              <th className="px-5 py-4 text-sm font-semibold text-neutral-100">
                Quantum Method
              </th>
              <th className="px-5 py-4 text-sm font-semibold text-neutral-100">
                Video
              </th>
              <th className="px-5 py-4 text-sm font-semibold text-neutral-100">
                Code
              </th>
            </tr>
          </thead>

          <tbody>
            {financeModels.map((model) => (
              <tr
                key={model.title}
                className="align-top border-b border-neutral-800 transition-colors hover:bg-neutral-900/60"
              >
                <td className="px-5 py-4 text-sm font-semibold text-neutral-100">
                  {model.title}
                </td>
                <td className="px-5 py-4 text-sm leading-6 text-neutral-300">
                  {model.businessProblem}
                </td>
                <td className="px-5 py-4 text-sm leading-6 text-neutral-300">
                  {model.data}
                </td>
                <td className="px-5 py-4 text-sm leading-6 text-neutral-300">
                  {model.quantumMethod}
                </td>
                <td className="px-5 py-4 text-sm">
                  <a
                    href={`#video-${model.videoNumber}`}
                    className="inline-flex rounded-full border border-neutral-700 px-3 py-1.5 font-medium text-neutral-200 transition hover:bg-neutral-800"
                  >
                    Video
                  </a>
                </td>
                <td className="px-5 py-4 text-sm">
                  <a
                    href={model.codeHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full border border-neutral-700 px-3 py-1.5 font-medium text-neutral-200 transition hover:bg-neutral-800"
                  >
                    Code
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function FinancePage() {
  const financeVideos = videos.filter((v) => (v.bins ?? []).includes("Finance"));

  return (
    <AppLayout>
      <Header />
      <section className="mx-auto max-w-6xl px-6 pt-24">
        <h1 className="mb-6 text-3xl font-bold text-cyan-300">Quantum Finance</h1>

        <p className="mb-8 text-l font-semibold leading-relaxed text-gray-200">
          Finance is one of the most practical entry points for quantum computing.
          The videos in this section show how portfolio optimization, option pricing,
          and fraud detection can be formulated as quantum problems.
          <br />
          <br />
          Many videos are supported by notebooks so you can follow the code,
          understand the algorithms, and evaluate where quantum may outperform
          classical methods.
        </p>

        <div className="mb-10">
          <TeaserCard
            title="Quantum Initiatives in Finance (2021–today)"
            subtitle="Click to play the preview. Or play the full video below for comments and more context."
            shortMp4Src="/teasers/finance-teaser-10s.mp4"
            posterSrc="/teasers/finance-teaser.jpg"
            youtubeUrl="https://youtu.be/5bvqJxxYHTQ"
          />
        </div>

        <FinanceModelsTable />

        <VideoGrid title="Finance Videos" videos={financeVideos} />
      </section>
    </AppLayout>
  );
}