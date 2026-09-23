import { TranslationEntry } from './types';

/**
 * Complete auth + users + roles + permissions translations (EN / AR).
 * Spread into TRANSLATIONS via index.ts as AUTH_TRANSLATIONS.
 */
export const AUTH_TRANSLATIONS: Record<string, TranslationEntry> = {
  // ---- App / landing / login / signup ----
  'auth.appName': { en: 'Fleet Ops', ar: 'إدارة الأسطول' },
  'auth.loginSubtitle': {
    en: 'Sign in to manage your fleet',
    ar: 'سجّل الدخول لإدارة الأسطول',
  },
  'auth.email': { en: 'Email', ar: 'البريد الإلكتروني' },
  'auth.password': { en: 'Password', ar: 'كلمة المرور' },
  'auth.signIn': { en: 'Sign in', ar: 'تسجيل الدخول' },
  'auth.signingIn': { en: 'Signing in…', ar: 'جارٍ تسجيل الدخول…' },
  'auth.signOut': { en: 'Sign out', ar: 'تسجيل الخروج' },
  'auth.loginFailed': {
    en: 'Invalid email or password.',
    ar: 'البريد أو كلمة المرور غير صحيحة.',
  },
  'auth.backToLanding': { en: 'Back to home', ar: 'العودة للرئيسية' },
  'auth.goToApp': { en: 'Open app', ar: 'فتح التطبيق' },
  'auth.landingTitle': {
    en: 'Fleet operations, maintenance & procurement in one place',
    ar: 'تشغيل الأسطول والصيانة والمشتريات في مكان واحد',
  },
  'auth.landingSubtitle': {
    en: 'Track vehicles, work orders, spare parts, invoices and technicians with role-based access.',
    ar: 'تتبع السيارات وأوامر الشغل وقطع الغيار والفواتير والفنيين بصلاحيات حسب الدور.',
  },
  'auth.featureFleet': { en: 'Fleet registry', ar: 'سجل الأسطول' },
  'auth.featureFleetDesc': {
    en: 'Vehicles, engines, missions and garage lodging.',
    ar: 'السيارات والمحركات والمأموريات والإيواء.',
  },
  'auth.featureMaint': { en: 'Maintenance', ar: 'الصيانة' },
  'auth.featureMaintDesc': {
    en: 'Work orders, overhauls, technicians and oil changes.',
    ar: 'أوامر الشغل والعمرات والفنيين وتغيير الزيت.',
  },
  'auth.featureFinance': { en: 'Parts & finance', ar: 'القطع والمالية' },
  'auth.featureFinanceDesc': {
    en: 'Stock, disbursements, invoices and checks.',
    ar: 'المخزون والصرف والفواتير والشيكات.',
  },

  // ---- Sign up ----
  'auth.signUp': { en: 'Sign up', ar: 'إنشاء حساب' },
  'auth.signingUp': { en: 'Creating account…', ar: 'جارٍ إنشاء الحساب…' },
  'auth.signupTitle': { en: 'Create account', ar: 'إنشاء حساب' },
  'auth.signupSubtitle': {
    en: 'Register to access Fleet Ops',
    ar: 'سجّل للوصول إلى نظام إدارة الأسطول',
  },
  'auth.signupSuccess': {
    en: 'Account created. You can sign in now (check your email if confirmation is required).',
    ar: 'تم إنشاء الحساب. يمكنك تسجيل الدخول الآن (تحقق من بريدك إذا كان التأكيد مطلوبًا).',
  },
  'auth.signupFailed': { en: 'Could not create account.', ar: 'تعذر إنشاء الحساب.' },
  'auth.haveAccount': { en: 'Already have an account?', ar: 'لديك حساب بالفعل؟' },
  'auth.noAccount': { en: 'No account?', ar: 'ليس لديك حساب؟' },
  'auth.fieldRequired': { en: 'This field is required.', ar: 'هذا الحقل مطلوب.' },
  'auth.emailInvalid': { en: 'Enter a valid email.', ar: 'أدخل بريدًا إلكترونيًا صحيحًا.' },
  'auth.passwordMin': {
    en: 'Password must be at least 6 characters.',
    ar: 'كلمة المرور 6 أحرف على الأقل.',
  },

  // ---- Header account menu ----
  'auth.accountMenu': { en: 'Account menu', ar: 'قائمة الحساب' },
  'auth.noRole': { en: 'No role assigned', ar: 'لا يوجد دور معيّن' },
  'auth.myAccount': { en: 'My account', ar: 'حسابي' },

  // ---- Profile ----
  'auth.profileTitle': { en: 'My profile', ar: 'ملفي الشخصي' },
  'auth.profileDetails': { en: 'Profile details', ar: 'بيانات الملف' },
  'auth.fullName': { en: 'Full name', ar: 'الاسم الكامل' },
  'auth.phone': { en: 'Phone', ar: 'الهاتف' },
  'auth.changePassword': { en: 'Change password', ar: 'تغيير كلمة المرور' },
  'auth.newPassword': { en: 'New password', ar: 'كلمة المرور الجديدة' },
  'auth.confirmPassword': { en: 'Confirm password', ar: 'تأكيد كلمة المرور' },
  'auth.updatePassword': { en: 'Update password', ar: 'تحديث كلمة المرور' },
  'auth.profileSaved': { en: 'Profile saved.', ar: 'تم حفظ الملف.' },
  'auth.profileSaveFailed': { en: 'Could not save profile.', ar: 'تعذر حفظ الملف.' },
  'auth.passwordChanged': { en: 'Password updated.', ar: 'تم تحديث كلمة المرور.' },
  'auth.passwordChangeFailed': {
    en: 'Could not change password.',
    ar: 'تعذر تغيير كلمة المرور.',
  },
  'auth.passwordMismatch': {
    en: 'Passwords do not match.',
    ar: 'كلمتا المرور غير متطابقتين.',
  },

  // ---- Users list ----
  'auth.usersTitle': { en: 'Users', ar: 'المستخدمون' },
  'auth.usersCount': { en: 'user(s)', ar: 'مستخدم/مستخدمين' },
  'auth.usersSubtitle': {
    en: 'Manage accounts, activation and role assignment.',
    ar: 'إدارة الحسابات والتفعيل وتعيين الأدوار.',
  },
  'auth.manageRoles': { en: 'Roles & permissions', ar: 'الأدوار والصلاحيات' },
  'auth.roles': { en: 'Roles', ar: 'الأدوار' },
  'auth.role': { en: 'Role', ar: 'الدور' },
  'auth.assignRoles': { en: 'Assign roles', ar: 'تعيين الأدوار' },
  'auth.selectRoles': { en: 'Select roles…', ar: 'اختر الأدوار…' },
  'auth.assignRolesHint': {
    en: 'Create the user in Supabase Auth first; the profile appears here automatically. Or use Sign up in the app.',
    ar: 'أنشئ المستخدم أولاً من لوحة Supabase Auth أو من صفحة إنشاء حساب؛ يظهر الملف هنا تلقائيًا.',
  },
  'auth.loadUsersFailed': { en: 'Failed to load users.', ar: 'فشل تحميل المستخدمين.' },
  'auth.saveRolesFailed': { en: 'Failed to save.', ar: 'فشل الحفظ.' },
  'auth.rolesSaved': { en: 'Roles updated.', ar: 'تم تحديث الأدوار.' },
  'auth.userActivated': { en: 'User activated.', ar: 'تم تفعيل المستخدم.' },
  'auth.userDeactivated': { en: 'User deactivated.', ar: 'تم تعطيل المستخدم.' },
  'auth.noUsers': { en: 'No users found.', ar: 'لا يوجد مستخدمون.' },
  'auth.colName': { en: 'Name', ar: 'الاسم' },
  'auth.colEmail': { en: 'Email', ar: 'البريد' },
  'auth.colRoles': { en: 'Roles', ar: 'الأدوار' },
  'auth.colStatus': { en: 'Status', ar: 'الحالة' },
  'auth.colActions': { en: 'Actions', ar: 'الإجراءات' },
  'auth.searchUsers': { en: 'Search by name or email…', ar: 'ابحث بالاسم أو البريد…' },

  // ---- Roles & permissions page ----
  'auth.rolesTitle': { en: 'Roles & permissions', ar: 'الأدوار والصلاحيات' },
  'auth.rolesSubtitle': {
    en: 'Select a role and tick the permissions it should grant.',
    ar: 'اختر دورًا وحدد الصلاحيات الممنوحة له.',
  },
  'auth.permissions': { en: 'Permissions', ar: 'الصلاحيات' },
  'auth.permission': { en: 'Permission', ar: 'صلاحية' },
  'auth.permissionsSaved': { en: 'Permissions saved.', ar: 'تم حفظ الصلاحيات.' },
  'auth.loadRolesFailed': { en: 'Failed to load roles.', ar: 'فشل تحميل الأدوار.' },
  'auth.systemRole': { en: 'System role', ar: 'دور نظام' },
  'auth.customRole': { en: 'Custom role', ar: 'دور مخصص' },
  'auth.selectAllModule': { en: 'Select all in module', ar: 'تحديد الكل في الوحدة' },
  'auth.clearAllModule': { en: 'Clear module', ar: 'إلغاء تحديد الوحدة' },
  'auth.noPermissions': { en: 'No permissions defined.', ar: 'لا توجد صلاحيات معرّفة.' },
  'auth.roleCode': { en: 'Code', ar: 'الرمز' },
  'auth.roleDescription': { en: 'Description', ar: 'الوصف' },

  // ---- Built-in role names (fallback labels) ----
  'auth.role.admin': { en: 'Administrator', ar: 'مدير النظام' },
  'auth.role.manager': { en: 'Manager', ar: 'مدير' },
  'auth.role.technician': { en: 'Technician', ar: 'فني' },
  'auth.role.viewer': { en: 'Viewer', ar: 'مشاهد' },

  // ---- Permission modules (shown as group headers) ----
  'auth.module.dashboard': { en: 'Dashboard', ar: 'لوحة التحكم' },
  'auth.module.vehicles': { en: 'Vehicles', ar: 'السيارات' },
  'auth.module.engines': { en: 'Engines', ar: 'المحركات' },
  'auth.module.technicians': { en: 'Technicians', ar: 'الفنيون' },
  'auth.module.maintenance': { en: 'Maintenance', ar: 'الصيانة' },
  'auth.module.overhauls': { en: 'Overhauls', ar: 'العمرات' },
  'auth.module.spare_parts': { en: 'Spare parts', ar: 'قطع الغيار' },
  'auth.module.invoices': { en: 'Invoices', ar: 'الفواتير' },
  'auth.module.checks': { en: 'Checks', ar: 'الشيكات' },
  'auth.module.analytics': { en: 'Analytics', ar: 'التحليلات' },
  'auth.module.reports': { en: 'Reports', ar: 'التقارير' },
  'auth.module.settings': { en: 'Settings', ar: 'الإعدادات' },
  'auth.module.users': { en: 'Users & roles', ar: 'المستخدمون والأدوار' },
  'auth.module.garage_lodging': { en: 'Garage lodging', ar: 'الإيواء' },
  'auth.module.vehicle_missions': { en: 'Vehicle missions', ar: 'المأموريات' },
  'auth.module.daily_notes': { en: 'Daily notes', ar: 'الملاحظات اليومية' },

  // ---- Individual permission codes (for UI if shown raw) ----
  'auth.perm.dashboard.view': { en: 'View dashboard', ar: 'عرض لوحة التحكم' },
  'auth.perm.vehicles.read': { en: 'View vehicles', ar: 'عرض السيارات' },
  'auth.perm.vehicles.write': { en: 'Manage vehicles', ar: 'إدارة السيارات' },
  'auth.perm.engines.read': { en: 'View engines', ar: 'عرض المحركات' },
  'auth.perm.engines.write': { en: 'Manage engines', ar: 'إدارة المحركات' },
  'auth.perm.technicians.read': { en: 'View technicians', ar: 'عرض الفنيين' },
  'auth.perm.technicians.write': { en: 'Manage technicians', ar: 'إدارة الفنيين' },
  'auth.perm.maintenance.read': { en: 'View maintenance', ar: 'عرض الصيانة' },
  'auth.perm.maintenance.write': { en: 'Manage maintenance', ar: 'إدارة الصيانة' },
  'auth.perm.overhauls.read': { en: 'View overhauls', ar: 'عرض العمرات' },
  'auth.perm.overhauls.write': { en: 'Manage overhauls', ar: 'إدارة العمرات' },
  'auth.perm.spare_parts.read': { en: 'View spare parts', ar: 'عرض قطع الغيار' },
  'auth.perm.spare_parts.write': { en: 'Manage spare parts', ar: 'إدارة قطع الغيار' },
  'auth.perm.invoices.read': { en: 'View invoices', ar: 'عرض الفواتير' },
  'auth.perm.invoices.write': { en: 'Manage invoices', ar: 'إدارة الفواتير' },
  'auth.perm.checks.read': { en: 'View checks', ar: 'عرض الشيكات' },
  'auth.perm.checks.write': { en: 'Manage checks', ar: 'إدارة الشيكات' },
  'auth.perm.analytics.view': { en: 'View analytics', ar: 'عرض التحليلات' },
  'auth.perm.reports.view': { en: 'View reports', ar: 'عرض التقارير' },
  'auth.perm.settings.manage': { en: 'Manage settings', ar: 'إدارة الإعدادات' },
  'auth.perm.users.manage': { en: 'Manage users & roles', ar: 'إدارة المستخدمين والصلاحيات' },
  'auth.perm.garage_lodging.read': { en: 'View garage lodging', ar: 'عرض الإيواء' },
  'auth.perm.garage_lodging.write': { en: 'Manage garage lodging', ar: 'إدارة الإيواء' },
  'auth.perm.vehicle_missions.read': { en: 'View missions', ar: 'عرض المأموريات' },
  'auth.perm.vehicle_missions.write': { en: 'Manage missions', ar: 'إدارة المأموريات' },
  'auth.perm.daily_notes.read': { en: 'View daily notes', ar: 'عرض الملاحظات' },
  'auth.perm.daily_notes.write': { en: 'Manage daily notes', ar: 'إدارة الملاحظات' },

  // ---- Access denied / guards ----
  'auth.accessDenied': { en: 'Access denied', ar: 'غير مسموح' },
  'auth.accessDeniedHint': {
    en: 'You do not have permission to open this page.',
    ar: 'ليس لديك صلاحية لفتح هذه الصفحة.',
  },
  'auth.sessionExpired': {
    en: 'Your session expired. Please sign in again.',
    ar: 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.',
  },
};
