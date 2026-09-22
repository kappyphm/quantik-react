import { phases } from './demo.js';

const KEY = 'quantik.poc.jobs.v1';
export function readJobs(){ try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
export function saveJobs(jobs){ localStorage.setItem(KEY, JSON.stringify(jobs)); }
export function progress(job, now){
  const step = Math.max(0, Math.min(phases.length - 1, Math.floor((now-job.createdAt)/2800)));
  return {step, phase:phases[step][0], label:phases[step][1], pct:phases[step][2], status:step===0?'queued':step===phases.length-1?'succeeded':'running'};
}
