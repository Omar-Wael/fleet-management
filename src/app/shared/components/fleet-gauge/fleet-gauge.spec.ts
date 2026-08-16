import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FleetGauge } from './fleet-gauge';

describe('FleetGauge', () => {
  let component: FleetGauge;
  let fixture: ComponentFixture<FleetGauge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FleetGauge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FleetGauge);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
