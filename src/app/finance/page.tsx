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
  toolHref?: string;
  toolLabel?: string;
};

const financeModels: FinanceModel[] = [
  {
    title: "Credit Spread Tail-Risk Scenario Generation",
    businessProblem:
      "Generate synthetic credit spread tail-risk scenarios from empirical copula dependence data.",
    data: "Real daily credit spread index data from 2020 to 2025 via FRED.",
    quantumMethod: "QCBM / quantum generative modeling",
    videoNumber: 19,
    codeHref:
      "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%2019%20Quantum%20Finance%20QCBM-Copula%20for%20Credit%20Tail%20Risk.ipynb",
  },
  {
    title: "Portfolio Optimization",
    businessProblem:
      "Optimize a Sharpe-ratio-driven portfolio of up to 10 assets under budget constraints.",
    data: "Real daily equity price data from mid-2024 to mid-2025 via yfinance.",
    quantumMethod: "QUBO / QAOA",
    videoNumber: 7,
    codeHref:
      "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%207%20Quantum%20Finance%20QAOA%20Portfolio%20Optimization.ipynb",
    toolHref: "/qaoa-rqp",
    toolLabel: "RQP Tool",
  },
  {
    title: "Credit Card Fraud Detection",
    businessProblem:
      "Detect fraudulent card transactions from labeled payment data.",
    data:
      "Public credit card transaction dataset (Mastercard), PCA-preprocessed, widely used for fraud-detection benchmarking.",
    quantumMethod: "VQC / quantum feature mapping",
    videoNumber: 9,
    codeHref:
      "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%209%20Quantum%20Finance%20QML%20for%20Fraud%20Detection.ipynb",
  },
  {
    title: "Derivative Pricing",
    businessProblem:
      "Estimate derivative prices using Monte Carlo methods and quantum amplitude-estimation concepts.",
    data: "Market-based option inputs and simulated payoff paths.",
    quantumMethod: "Quantum Monte Carlo / amplitude estimation",
    videoNumber: 8,
    codeHref:
      "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%208%20Quantum%20Finance%20Quantum%20Monte%20Carlo%20Option%20Pricing.ipynb",
  },
  {
    title: "Market Stress Regime Classification",
    businessProblem:
      "Classify market stress regimes from equity, volatility, and derived market signals.",
    data:
      "Real daily S&P 500 and implied-volatility data with derived indicators.",
    quantumMethod: "Quantum classification / hybrid quantum-classical model",
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
          Applied Quantum Models for Finance
        </h2>
        <p className="mt-2 max-w-3xl text-m leading-6 text-gray-300">
          Not just theory, but concrete prototypes: real datasets, working
          notebooks, and step-by-step videos that make the methods transparent
          and testable. Test it yourself.
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
                Code / Tool
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
                    #{model.videoNumber}
                  </a>
                </td>
                <td className="px-5 py-4 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={model.codeHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-full border border-neutral-700 px-3 py-1.5 font-medium text-neutral-200 transition hover:bg-neutral-800"
                    >
                      Code
                    </a>

                    {model.toolHref && (
                      <a
                        href={model.toolHref}
                        className="inline-flex rounded-full border border-cyan-700 bg-cyan-500/10 px-3 py-1.5 font-semibold text-cyan-200 transition hover:bg-cyan-500 hover:text-slate-950"
                      >
                        {model.toolLabel ?? "Tool"}
                      </a>
                    )}
                  </div>
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
        <h1 className="mb-6 text-3xl font-bold text-cyan-300">
          Quantum Finance
        </h1>

        <p className="mb-8 text-l font-semibold leading-relaxed text-gray-200">
          Finance is one of the most practical entry points for quantum
          computing. The videos in this section show how portfolio optimization,
          option pricing, and fraud detection can be formulated as quantum
          problems.
          <br />
          <br />
          Many videos are supported by notebooks so you can follow the code,
          understand the algorithms, and evaluate where quantum may outperform
          classical methods.
        </p>

        <div className="mb-10">
          <TeaserCard
            title="Quantum Initiatives in Finance (2021–today)"
            subtitle="Click to play the preview. Or play the full video #16 below for comments and much more context."
            shortMp4Src="/teasers/finance-teaser-10s.mp4"
            posterSrc="/teasers/finance-teaser.jpg"
            youtubeUrl="https://youtu.be/5bvqJxxYHTQ"
          />
        </div>

        <div className="mb-10 rounded-2xl border border-cyan-900/70 bg-slate-950/80 p-6 shadow-lg">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-cyan-300">
                New tool
              </p>
              <h2 className="text-2xl font-bold text-white">
                Quantum Portfolio Optimizer
              </h2>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-300">
                Test the new Rapid Quantum Prototyping Tool by qubit-lab.ch.
                Define a portfolio optimization problem in Excel and let the tool
                build the QUBO, QAOA setup, simulation outputs, and diagnostics.
              </p>
            </div>

            <a
              href="/qaoa-rqp"
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Open QAOA RQP Tool
            </a>
          </div>
        </div>

        <FinanceModelsTable />

        <VideoGrid title="Finance Videos" videos={financeVideos} />
      </section>
    </AppLayout>
  );
}