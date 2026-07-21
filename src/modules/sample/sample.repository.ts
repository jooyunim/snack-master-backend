import prisma from '../../config/prisma';

export const sampleRepository = {
  findAll: () => prisma.sample.findMany({ orderBy: { createdAt: 'desc' } }),

  findById: (id: number) => prisma.sample.findUnique({ where: { id } }),
};
