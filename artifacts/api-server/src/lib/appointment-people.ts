import { validLogoPath } from "./customer-logos";

/** Participant photos use the same private raster-image storage as client logos. */
export function appointmentPhotoPaths(metadata: Record<string, unknown>): string[] {
  const paths: string[] = [];
  const addPhoto = (value: unknown) => {
    if (value === undefined || value === "") return;
    if (typeof value !== "string" || !validLogoPath(value)) {
      throw new Error("Envie as fotos dos participantes pelo cadastro do compromisso.");
    }
    paths.push(value);
  };
  addPhoto(metadata.responsiblePhotoPath);
  if (metadata.participants !== undefined) {
    if (!Array.isArray(metadata.participants) || metadata.participants.length > 20) {
      throw new Error("Adicione até 20 participantes ao compromisso.");
    }
    const ids = new Set<string>();
    for (const value of metadata.participants) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Confira os dados dos participantes.");
      }
      const person = value as Record<string, unknown>;
      if (typeof person.id !== "string" || !person.id.trim() || person.id.length > 100 || ids.has(person.id)) {
        throw new Error("Cada participante deve ter um identificador único.");
      }
      if (typeof person.name !== "string" || !person.name.trim() || person.name.length > 200) {
        throw new Error("Informe o nome de cada participante com até 200 caracteres.");
      }
      ids.add(person.id);
      addPhoto(person.photoPath);
    }
  }
  return [...new Set(paths)];
}
