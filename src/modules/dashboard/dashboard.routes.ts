import { FastifyPluginAsync } from "fastify";
import fs from "fs";
import { resolveTenantId, getTenantFilePath } from "../tenants/tenants.service";

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/dashboard/stats", async (request, reply) => {
    const tenantId = resolveTenantId(request);

    // 1. Clientes del tenant activo
    let customers: any[] = [];
    try {
      const custFile = getTenantFilePath(tenantId, "customers.json");
      if (fs.existsSync(custFile)) {
        customers = JSON.parse(fs.readFileSync(custFile, "utf-8"));
      }
    } catch {}

    const totalCust = customers.length;
    const activeCust = customers.filter(c => c.serviceStatus === "active" || c.status === "active").length;
    const suspendedCust = customers.filter(c => c.serviceStatus === "suspended" || c.status === "suspended").length;
    const pendingCust = customers.filter(c => c.serviceStatus === "pending_installation" || c.status === "pending_installation").length;

    // 2. Dispositivos de red del tenant activo
    let devices: any[] = [];
    try {
      const devFile = getTenantFilePath(tenantId, "devices.json");
      if (fs.existsSync(devFile)) {
        devices = JSON.parse(fs.readFileSync(devFile, "utf-8"));
      }
    } catch {}

    const totalDev = devices.length;
    const onlineDev = devices.filter(d => d.status === "online").length;

    // 3. Facturación del tenant activo
    let invoices: any[] = [];
    try {
      const invFile = getTenantFilePath(tenantId, "invoices.json");
      if (fs.existsSync(invFile)) {
        invoices = JSON.parse(fs.readFileSync(invFile, "utf-8"));
      }
    } catch {}

    const totalBilled = invoices.reduce((acc, i) => acc + parseFloat(i.total || 0), 0);
    const collected = invoices.filter(i => i.status === "paid").reduce((acc, i) => acc + parseFloat(i.total || 0), 0);
    const pending = invoices.filter(i => i.status === "pending" || i.status === "overdue").reduce((acc, i) => acc + parseFloat(i.total || 0), 0);
    const collectionPercent = totalBilled > 0 ? parseFloat(((collected / totalBilled) * 100).toFixed(1)) : 0;

    return reply.send({
      success: true,
      tenantId,
      data: {
        customers: {
          total: totalCust,
          active: activeCust,
          suspended: suspendedCust,
          pendingInstallation: pendingCust,
          growthRate: "+5.2% este mes",
        },
        financials: {
          monthlyTarget: totalBilled.toFixed(2),
          collected: collected.toFixed(2),
          pending: pending.toFixed(2),
          collectionPercent,
          currency: "$",
        },
        network: {
          totalDevices: totalDev,
          onlineDevices: onlineDev,
          activeBandwidthGbps: "2.4 Gbps",
          peakUsageTime: "20:00 - 22:30",
          status: "healthy",
        },
        recentActivity: invoices.slice(0, 4).map(inv => ({
          type: "payment",
          description: `Recibo #${inv.invoiceNumber} - ${inv.customerName} ($${inv.total})`,
          time: inv.paidDate ? new Date(inv.paidDate).toLocaleTimeString() : "Reciente"
        })),
      },
    });
  });
};
