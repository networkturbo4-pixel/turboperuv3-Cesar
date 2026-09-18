import { FastifyPluginAsync } from "fastify";

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/dashboard/stats", async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        customers: {
          total: 1248,
          active: 1195,
          suspended: 38,
          pendingInstallation: 15,
          growthRate: "+8.4% este mes",
        },
        financials: {
          monthlyTarget: "28,500.00",
          collected: "22,450.00",
          pending: "6,050.00",
          collectionPercent: 78.7,
          currency: "$",
        },
        network: {
          totalDevices: 14,
          onlineDevices: 14,
          activeBandwidthGbps: "4.8 Gbps",
          peakUsageTime: "20:30 - 22:00",
          status: "healthy",
        },
        recentActivity: [
          { type: "payment", description: "Pago registrado $35.00 - Carlos Mendoza (CLI-1001)", time: "Hace 5 min" },
          { type: "customer", description: "Nuevo contrato creado - David Fernández (CLI-1004)", time: "Hace 25 min" },
          { type: "network", description: "OLT Huawei MA5608T sincronizada (485 ONUs online)", time: "Hace 1 hora" },
          { type: "payment", description: "Pago registrado $90.00 - Inversiones Andina", time: "Hace 2 horas" },
        ],
      },
    });
  });
};
