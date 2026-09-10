import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { fromSupabase } from '../supabase/from-supabase.util';

export type EntityImageType =
  | 'vehicle'
  | 'invoice'
  | 'check'
  | 'disbursement_request'
  | 'spare_part'
  | 'garage_lodging'
  | 'vehicle_mission';

export interface EntityImage {
  id: string;
  entity_type: EntityImageType;
  entity_id: string;
  storage_path: string;
  public_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  is_primary: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
}

const BUCKET = 'entity-images';

@Injectable({ providedIn: 'root' })
export class EntityImagesService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  list(entityType: EntityImageType, entityId: string): Observable<EntityImage[]> {
    return fromSupabase<EntityImage[]>(
      this.client
        .from('entity_images')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true }),
    );
  }

  getPrimary(entityType: EntityImageType, entityId: string): Observable<EntityImage | null> {
    return fromSupabase<EntityImage[]>(
      this.client
        .from('entity_images')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('is_primary', true)
        .limit(1),
    ).pipe(map((rows) => rows[0] ?? null));
  }

  /**
   * Upload a file to Storage and insert metadata.
   * Path: {entityType}/{entityId}/{timestamp}_{filename}
   */
  upload(
    entityType: EntityImageType,
    entityId: string,
    file: File,
    opts?: { isPrimary?: boolean; notes?: string },
  ): Observable<EntityImage> {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${entityType}/${entityId}/${Date.now()}_${safeName}`;

    return from(
      this.client.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      }),
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        const storagePath = data?.path ?? path;
        const { data: urlData } = this.client.storage.from(BUCKET).getPublicUrl(storagePath);
        const publicUrl = urlData?.publicUrl ?? null;

        const row = {
          entity_type: entityType,
          entity_id: entityId,
          storage_path: storagePath,
          public_url: publicUrl,
          file_name: file.name,
          mime_type: file.type || null,
          is_primary: opts?.isPrimary ?? false,
          notes: opts?.notes ?? null,
        };

        const insert$ = fromSupabase<EntityImage>(
          this.client.from('entity_images').insert(row).select().single(),
        );

        if (opts?.isPrimary) {
          return from(
            this.client
              .from('entity_images')
              .update({ is_primary: false })
              .eq('entity_type', entityType)
              .eq('entity_id', entityId) as any,
          ).pipe(switchMap(() => insert$));
        }
        return insert$;
      }),
    );
  }

  setPrimary(imageId: string, entityType: EntityImageType, entityId: string): Observable<null> {
    return from(
      this.client
        .from('entity_images')
        .update({ is_primary: false })
        .eq('entity_type', entityType)
        .eq('entity_id', entityId) as any,
    ).pipe(
      switchMap(() =>
        fromSupabase<null>(
          this.client.from('entity_images').update({ is_primary: true }).eq('id', imageId) as any,
        ),
      ),
    );
  }

  delete(image: EntityImage): Observable<null> {
    return from(this.client.storage.from(BUCKET).remove([image.storage_path])).pipe(
      switchMap(({ error }) => {
        if (error) {
          // Still remove DB row even if storage object is missing
          console.warn('Storage remove failed', error);
        }
        return fromSupabase<null>(this.client.from('entity_images').delete().eq('id', image.id));
      }),
    );
  }
}
