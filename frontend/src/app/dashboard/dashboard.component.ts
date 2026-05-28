import { Component, OnInit, NgZone } from '@angular/core';
import { io } from 'socket.io-client';

import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatCardModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  socket = io('http://localhost:5000');

  cpu = 0;
  ram = 0;
  uptime = 0;

  // ✅ THIS IS MISSING IN YOUR CODE
  constructor(private ngZone: NgZone) {}

  ngOnInit() {
    this.socket.on('metrics', (data: any) => {
      console.log("Received:", data);

      this.ngZone.run(() => {
        this.cpu = data.cpu;
        this.ram = data.ram;
        this.uptime = data.uptime;
      });
    });
  }
}