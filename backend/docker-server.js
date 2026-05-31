const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const Docker = require("dockerode");

const docker = new Docker();

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.get("/", (req, res) => {
  res.send("Docker Monitoring Backend 🚀");
});

/* ===========================
   FETCH CONTAINER LOGS
=========================== */
app.get("/logs/:containerName", async (req, res) => {
  try {
    const containerName = req.params.containerName;

    const containers = await docker.listContainers({
      all: true
    });

    const containerInfo = containers.find(c =>
      c.Names.some(
        n => n.replace("/", "") === containerName
      )
    );

    if (!containerInfo) {
      return res.status(404).json({
        error: "Container not found"
      });
    }

    const container = docker.getContainer(
      containerInfo.Id
    );

    const logsBuffer = await container.logs({
      stdout: true,
      stderr: true,
      tail: 30,
      timestamps: false
    });

    let output = "";

    try {
      let offset = 0;

      while (offset < logsBuffer.length) {
        const length =
          logsBuffer.readUInt32BE(offset + 4);

        output += logsBuffer
          .slice(
            offset + 8,
            offset + 8 + length
          )
          .toString("utf8");

        offset += 8 + length;
      }
    } catch {
      output = logsBuffer.toString("utf8");
    }

    res.json({
      logs: output
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to fetch logs"
    });
  }
});

/* ===========================
   SOCKET.IO METRICS
=========================== */
io.on("connection", socket => {

  console.log("Client connected");

  const interval = setInterval(async () => {

    try {

      const containers =
        await docker.listContainers({
          all: true
        });

      const metrics = await Promise.all(
        containers.map(async containerInfo => {

          try {

            const container =
              docker.getContainer(
                containerInfo.Id
              );

            let cpu = "0.00";
            let ram = "0.00";

            /* -----------------------
               RUNNING CONTAINER
            ----------------------- */
            if (
              containerInfo.State === "running"
            ) {

              const stats =
                await container.stats({
                  stream: false
                });

              const cpuDelta =
                stats.cpu_stats.cpu_usage.total_usage -
                stats.precpu_stats.cpu_usage.total_usage;

              const systemDelta =
                stats.cpu_stats.system_cpu_usage -
                stats.precpu_stats.system_cpu_usage;

              const cpuCount =
                stats.cpu_stats.online_cpus || 1;

              cpu =
                systemDelta > 0
                  ? (
                      (cpuDelta /
                        systemDelta) *
                      cpuCount *
                      100
                    ).toFixed(2)
                  : "0.00";

              const memoryUsage =
                stats.memory_stats.usage || 0;

              const memoryLimit =
                stats.memory_stats.limit || 1;

              ram = (
                (memoryUsage /
                  memoryLimit) *
                100
              ).toFixed(2);
            }

            /* -----------------------
               HEALTH STATUS
            ----------------------- */
            let health = "HEALTHY";

            if (
              containerInfo.State !== "running"
            ) {
              health = "STOPPED";
            }
            else if (
              Number(cpu) > 80 ||
              Number(ram) > 85
            ) {
              health = "CRITICAL";
            }
            else if (
              Number(cpu) > 60 ||
              Number(ram) > 70
            ) {
              health = "WARNING";
            }

            return {
              id: containerInfo.Id,

              name:
                containerInfo.Names[0].replace(
                  "/",
                  ""
                ),

              image: containerInfo.Image,

              type: "Docker Container",

              region: "Local Docker",

              status: containerInfo.State,

              cpu,

              ram,

              health
            };

          } catch (err) {

            console.error(
              "Container error:",
              err.message
            );

            return {
              id: containerInfo.Id,

              name:
                containerInfo.Names[0].replace(
                  "/",
                  ""
                ),

              image: containerInfo.Image,

              type: "Docker Container",

              region: "Local Docker",

              status: containerInfo.State,

              cpu: "0.00",

              ram: "0.00",

              health:
                containerInfo.State === "running"
                  ? "WARNING"
                  : "STOPPED"
            };
          }
        })
      );

      io.emit("metrics", metrics);

    } catch (err) {
      console.error(
        "Metrics error:",
        err.message
      );
    }

  }, 2000);

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    clearInterval(interval);
  });

});

/* ===========================
   START SERVER
=========================== */
server.listen(5000, () => {
  console.log(
    "Docker monitoring running on port 5000"
  );
});