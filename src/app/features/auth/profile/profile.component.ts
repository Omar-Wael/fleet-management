import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly i18n = inject(TranslationService);

  saving = false;
  saveMsg: string | null = null;
  saveError: string | null = null;

  pwdSaving = false;
  pwdMsg: string | null = null;
  pwdError: string | null = null;

  profileForm = this.fb.nonNullable.group({
    full_name: [''],
    phone: [''],
    email: [{ value: '', disabled: true }],
  });

  passwordForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const p = this.auth.profile();
    this.profileForm.patchValue({
      full_name: p?.full_name ?? '',
      phone: p?.phone ?? '',
      email: p?.email ?? this.auth.user().email ?? '',
    });
  }

  get roleLabels(): string {
    const roles = this.auth.roles();
    if (!roles.length) return '—';
    return roles
      .map((r) => (this.i18n.lang() === 'ar' ? r.name_ar : r.name_en))
      .join(', ');
  }

  saveProfile(): void {
    this.saving = true;
    this.saveMsg = null;
    this.saveError = null;
    this.cdr.markForCheck();
    const { full_name, phone } = this.profileForm.getRawValue();
    this.auth.updateProfile({ full_name, phone }).subscribe({
      next: () => {
        this.saving = false;
        this.saveMsg = this.i18n.t('auth.profileSaved');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err?.message || this.i18n.t('auth.profileSaveFailed');
        this.cdr.markForCheck();
      },
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { password, confirm } = this.passwordForm.getRawValue();
    if (password !== confirm) {
      this.pwdError = this.i18n.t('auth.passwordMismatch');
      this.cdr.markForCheck();
      return;
    }
    this.pwdSaving = true;
    this.pwdMsg = null;
    this.pwdError = null;
    this.cdr.markForCheck();
    this.auth.changePassword(password).subscribe({
      next: () => {
        this.pwdSaving = false;
        this.pwdMsg = this.i18n.t('auth.passwordChanged');
        this.passwordForm.reset();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.pwdSaving = false;
        this.pwdError = err?.message || this.i18n.t('auth.passwordChangeFailed');
        this.cdr.markForCheck();
      },
    });
  }
}
