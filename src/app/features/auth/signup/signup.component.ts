import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly i18n = inject(TranslationService);

  loading = false;
  error: string | null = null;
  success: string | null = null;

  form = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirm: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }
    const { full_name, email, password, confirm } = this.form.getRawValue();
    if (password !== confirm) {
      this.error = this.i18n.t('auth.passwordMismatch');
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;
    this.cdr.markForCheck();

    this.auth.signUp(email, password, full_name).subscribe({
      next: () => {
        this.loading = false;
        // If email confirmation is disabled, session may already exist → go dashboard
        if (this.auth.isAuthenticated()) {
          void this.router.navigateByUrl('/dashboard');
          return;
        }
        this.success = this.i18n.t('auth.signupSuccess');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message || this.i18n.t('auth.signupFailed');
        this.cdr.markForCheck();
      },
    });
  }
}
