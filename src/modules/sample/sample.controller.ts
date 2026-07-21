import { Request, Response } from 'express';
import { findAllSamples, findSampleById } from './sample.service';

export const getSamples = async (req: Request, res: Response) => {
  const samples = await findAllSamples();
  res.json(samples);
};

export const getSampleById = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const sample = await findSampleById(id);
  if (!sample) return res.status(404).json({ message: 'Not found' });
  res.json(sample);
};
