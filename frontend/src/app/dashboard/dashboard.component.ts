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

import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,   // ✅ FIXED (THIS WAS MISSING)
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatCardModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit {

  @ViewChild('cpuChartCanvas') cpuChartCanvas!: ElementRef;

  socket = io('http://localhost:5000');

  cpuChart: any;

  cpu = 0;
  ram = 0;
  uptime = 0;

  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit() {
    this.initChart();
  }

  ngOnInit() {
    this.socket.on('metrics', (data: any) => {

      console.log("Received:", data);

      this.ngZone.run(() => {

        this.cpu = data.cpu;
        this.ram = data.ram;
        this.uptime = data.uptime;

        this.updateStatus(Number(data.cpu), Number(data.ram));

        if (!this.cpuChart) return;

        this.cpuChart.data.labels.push(new Date().toLocaleTimeString());
        this.cpuChart.data.datasets[0].data.push(Number(data.cpu));
        this.cpuChart.data.datasets[1].data.push(Number(data.ram));

        if (this.cpuChart.data.labels.length > 10) {
          this.cpuChart.data.labels.shift();
          this.cpuChart.data.datasets[0].data.shift();
          this.cpuChart.data.datasets[1].data.shift();
        }

        this.cpuChart.update();
      });
    });
  }

  initChart() {
    this.cpuChart = new Chart(this.cpuChartCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'CPU %',
            data: [],
            borderColor: 'red',
            tension: 0.3
          },
          {
            label: 'RAM %',
            data: [],
            borderColor: 'blue',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        animation: false,
        scales: {
          y: {
            min: 0,
            max: 100
          }
        }
      }
    });
  }

  updateStatus(cpu: number, ram: number) {
    if (cpu > 80 || ram > 85) {
      this.status = 'CRITICAL';
    }
    else if (cpu > 60 || ram > 70) {
      this.status = 'WARNING';
    }
    else {
      this.status = 'HEALTHY';
    }
  }
}