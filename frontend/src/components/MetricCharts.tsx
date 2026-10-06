import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { AuthorMetric, FileMetric, DirectoryMetric } from '../services/api';

const PALETTE = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c',
  '#ca8a04', '#16a34a', '#0891b2', '#4b5563',
];

const short = (p: string, n = 30) => (p.length > n ? '…' + p.slice(-(n - 1)) : p);

type ChurnItem = { path: string; churn: number };

export const TopChurnBar: React.FC<{ title: string; items: ChurnItem[] }> = ({ title, items }) => {
  const top = [...items]
    .sort((a, b) => b.churn - a.churn)
    .slice(0, 10)
    .map((i) => ({ name: short(i.path), churn: i.churn }));
  if (!top.length) {
    return (
      <div className="chart-card chart-empty">
        <h3>{title}</h3>
        <p>No churn data for the current filters.</p>
      </div>
    );
  }
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={top} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="churn" fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const AddedRemovedBar: React.FC<{ items: (FileMetric | DirectoryMetric)[] }> = ({ items }) => {
  const top = [...items]
    .sort((a, b) => b.churn - a.churn)
    .slice(0, 8)
    .map((i) => ({ name: short(i.path, 18), added: i.added_lines, removed: i.removed_lines }));
  if (!top.length) {
    return (
      <div className="chart-card chart-empty">
        <h3>Added vs Removed (most volatile)</h3>
        <p>No line-change data for the current filters.</p>
      </div>
    );
  }
  return (
    <div className="chart-card">
      <h3>Added vs Removed (most volatile)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={top}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="added" stackId="a" fill="#16a34a" />
          <Bar dataKey="removed" stackId="a" fill="#dc2626" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const OwnershipPie: React.FC<{ authors: AuthorMetric[] }> = ({ authors }) => {
  const sorted = [...authors]
    .filter((a) => a.churn > 0)
    .sort((a, b) => b.churn - a.churn);
  const total = sorted.reduce((sum, author) => sum + author.churn, 0);
  const top = sorted.slice(0, 7).map((a) => ({ name: a.author, value: a.churn }));
  const rest = sorted.slice(7).reduce((s, a) => s + a.churn, 0);
  if (rest > 0) top.push({ name: 'Others', value: rest });
  if (!top.length) {
    return (
      <div className="chart-card chart-empty">
        <h3>Churn ownership by author</h3>
        <p>No author churn data for the current filters.</p>
      </div>
    );
  }
  return (
    <div className="chart-card">
      <h3>Churn ownership by author</h3>
      <div className="ownership-chart">
        <div className="ownership-pie">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={top} dataKey="value" nameKey="name" outerRadius={92}>
                {top.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${Number(value ?? 0).toLocaleString()} lines`, 'Lines changed']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="ownership-legend">
          {top.map((item, i) => (
            <li key={item.name}>
              <span className="legend-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="legend-name" title={item.name}>{item.name}</span>
              <strong>{((item.value / total) * 100).toFixed(1)}%</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
