import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function SentimentDashboard({ sentiment = { good: 0, neutral: 0, negative: 0 } }) {
  const total = sentiment.good + sentiment.neutral + sentiment.negative;

  const data = {
    labels: ['Good', 'Neutral', 'Bad'],
    datasets: [
      {
        data: [sentiment.good, sentiment.neutral, sentiment.negative],
        backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
        borderColor: ['#16a34a', '#ca8a04', '#dc2626'],
        borderWidth: 2
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 15, font: { size: 12 } }
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
      <h2 className="text-lg font-bold text-slate-800 mb-4">Session Sentiment</h2>

      <div className="h-64">
        {total > 0 ? (
          <Doughnut data={data} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            <p>No responses yet</p>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <p className="text-xs text-green-600 font-medium">Good</p>
          <p className="text-2xl font-bold text-green-700">{sentiment.good}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
          <p className="text-xs text-yellow-600 font-medium">Neutral</p>
          <p className="text-2xl font-bold text-yellow-700">{sentiment.neutral}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
          <p className="text-xs text-red-600 font-medium">Bad</p>
          <p className="text-2xl font-bold text-red-700">{sentiment.negative}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-sm text-slate-600">
          Total responses: <span className="font-semibold text-slate-800">{total}</span>
        </p>
      </div>
    </div>
  );
}