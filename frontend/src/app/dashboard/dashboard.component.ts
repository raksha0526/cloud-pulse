import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  AfterViewInit,
  NgZone,
  ViewChild,
  ElementRef
} from '@angular/core';

import { Chart } from 'chart.js/auto';
import { io } from 'socket.io-client';

import { HttpClient, HttpClientModule } from '@angular/common/http';

import {
  MatSnackBar,
  MatSnackBarModule
} from '@angular/material/snack-bar';

import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    MatButtonModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatCardModule,
    MatSnackBarModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent
  implements OnInit, AfterViewInit {

  @ViewChild('cpuChartCanvas')
  cpuChartCanvas!: ElementRef;

  socket = io('http://localhost:5000');

  cpuChart: any;

  cpu = 0;
  ram = 0;
  uptime = 0;

  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' =
    'HEALTHY';

  servers: any[] = [];
  alerts: string[] = [];

  totalContainers = 0;
  runningContainers = 0;
  stoppedContainers = 0;
  criticalAlerts = 0;

  logs = '';
  selectedContainer = '';

  constructor(
    private ngZone: NgZone,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {}

  ngAfterViewInit(): void {
    this.initChart();
  }

  ngOnInit(): void {

    const cachedServers =
      localStorage.getItem('lastServers');

    if (cachedServers) {
      this.servers = JSON.parse(cachedServers);
    }

    this.socket.on('metrics', (data: any[]) => {

      this.ngZone.run(() => {

        this.servers = data;

        localStorage.setItem(
          'lastServers',
          JSON.stringify(data)
        );

        this.totalContainers = data.length;

        this.runningContainers =
          data.filter(
            s =>
              s.status?.toLowerCase() ===
              'running'
          ).length;

        this.stoppedContainers =
          this.totalContainers -
          this.runningContainers;

        this.criticalAlerts =
          data.filter(
            s =>
              Number(s.cpu) > 80 ||
              Number(s.ram) > 85
          ).length;

        data.forEach(server => {

          if (Number(server.cpu) > 80) {
            this.addAlert(
              `🚨 ${server.name} CPU critical (${server.cpu}%)`
            );
          }

          if (Number(server.ram) > 85) {
            this.addAlert(
              `⚠ ${server.name} RAM critical (${server.ram}%)`
            );
          }

        });

        if (!data.length) return;

        const firstServer = data[0];

        this.cpu = Number(firstServer.cpu);
        this.ram = Number(firstServer.ram);

        this.uptime++;

        this.updateStatus(data);

        if (!this.cpuChart) return;

        const currentTime =
          new Date().toLocaleTimeString();

        const labels = [
          ...this.cpuChart.data.labels,
          currentTime
        ];

        const cpuData = [
          ...this.cpuChart.data.datasets[0].data,
          Number(firstServer.cpu)
        ];

        const ramData = [
          ...this.cpuChart.data.datasets[1].data,
          Number(firstServer.ram)
        ];

        if (labels.length > 10) {
          labels.shift();
          cpuData.shift();
          ramData.shift();
        }

        this.cpuChart.data.labels = labels;
        this.cpuChart.data.datasets[0].data =
          cpuData;
        this.cpuChart.data.datasets[1].data =
          ramData;

        this.cpuChart.update();
      });
    });
  }

  initChart(): void {

    this.cpuChart = new Chart(
      this.cpuChartCanvas.nativeElement,
      {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'CPU %',
              data: [],
              borderColor: '#ef4444',
              backgroundColor:
                'rgba(239,68,68,0.1)',
              tension: 0.3,
              fill: true
            },
            {
              label: 'RAM %',
              data: [],
              borderColor: '#3b82f6',
              backgroundColor:
                'rgba(59,130,246,0.1)',
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          animation: false,
          plugins: {
            legend: {
              labels: {
                color: '#e2e8f0'
              }
            }
          },
          scales: {
            x: {
              grid: {
                color:
                  'rgba(255,255,255,0.1)'
              },
              ticks: {
                color: '#94a3b8'
              }
            },
            y: {
              min: 0,
              max: 100,
              grid: {
                color:
                  'rgba(255,255,255,0.1)'
              },
              ticks: {
                color: '#94a3b8'
              }
            }
          }
        }
      }
    );
  }

  updateStatus(servers: any[]): void {

    const isCritical = servers.some(
      s =>
        Number(s.cpu) > 80 ||
        Number(s.ram) > 85
    );

    const isWarning = servers.some(
      s =>
        Number(s.cpu) > 60 ||
        Number(s.ram) > 70
    );

    if (isCritical) {
      this.status = 'CRITICAL';
    } else if (isWarning) {
      this.status = 'WARNING';
    } else {
      this.status = 'HEALTHY';
    }
  }
viewLogs(containerName: string): void {

  this.selectedContainer = containerName;
  this.logs = 'Loading logs...';

  this.http
    .get<any>(
      `http://localhost:5000/logs/${containerName}`
    )
    .subscribe({
      next: (res) => {

        let cleanedLogs =
          res.logs || 'No logs available.';

        // Remove ANSI colors
        cleanedLogs = cleanedLogs.replace(
          /\u001b\[[0-9;]*m/g,
          ''
        );

        // Remove control characters
        cleanedLogs = cleanedLogs.replace(
          /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g,
          ''
        );

        this.logs = cleanedLogs;
      },

      error: err => {
        console.error(err);
        this.logs = 'Failed to load logs.';
      }
    });
}

  addAlert(message: string): void {

    if (this.alerts[0] === message) {
      return;
    }

    this.alerts.unshift(message);

    if (this.alerts.length > 5) {
      this.alerts.pop();
    }

    this.snackBar.open(
      message,
      'Close',
      {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      }
    );
  }
}