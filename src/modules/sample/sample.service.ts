import { sampleRepository } from './sample.repository';

export const findAllSamples = async () => {
  return sampleRepository.findAll();
};

export const findSampleById = async (id: number) => {
  return sampleRepository.findById(id);
};
