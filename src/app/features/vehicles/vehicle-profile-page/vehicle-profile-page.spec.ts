import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VehicleProfilePage } from './vehicle-profile-page';

describe('VehicleProfilePage', () => {
  let component: VehicleProfilePage;
  let fixture: ComponentFixture<VehicleProfilePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VehicleProfilePage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VehicleProfilePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
