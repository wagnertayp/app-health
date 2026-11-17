import test from "node:test";
import assert from "node:assert/strict";
import { attachmentRange, matchesAttachmentType, safeAttachmentName } from "./customer-attachment-types";

test("PDF, supported raster images and text are recognized by their actual bytes", () => {
  assert.equal(matchesAttachmentType(Buffer.from("%PDF-1.7"), "application/pdf"), true);
  assert.equal(matchesAttachmentType(Buffer.from("GIF89a"), "image/gif"), true);
  assert.equal(matchesAttachmentType(Buffer.from([255, 216, 255, 0]), "image/jpeg"), true);
  assert.equal(matchesAttachmentType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"), true);
  assert.equal(matchesAttachmentType(Buffer.from("RIFF1234WEBP"), "image/webp"), true);
  assert.equal(matchesAttachmentType(Buffer.from("Atualização do cliente"), "text/plain"), true);
  assert.equal(matchesAttachmentType(Buffer.from("nome,valor\nCliente,20"), "text/csv"), true);
  assert.equal(matchesAttachmentType(Buffer.from("# Atualização"), "text/markdown"), true);
});
test("Forged MIME types, executable image formats and binary text are rejected", () => {
  for (const mime of ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "audio/mpeg"]) {
    assert.equal(matchesAttachmentType(Buffer.from("<script>alert(1)</script>"), mime), false);
  }
  assert.equal(matchesAttachmentType(Buffer.from("<svg/>"), "image/svg+xml"), false);
  assert.equal(matchesAttachmentType(Buffer.from("<html/>"), "text/html"), false);
  assert.equal(matchesAttachmentType(Buffer.from([0, 255]), "text/plain"), false);
  assert.equal(matchesAttachmentType(Buffer.from([255, 255]), "text/plain"), false);
});
test("Audio containers match the selected audio format", () => {
  for (const [header, type] of [["ID3", "audio/mpeg"], ["RIFF1234WAVE", "audio/wav"], ["OggS", "audio/ogg"], ["fLaC", "audio/flac"], ["1234ftypM4A ", "audio/mp4"]]) {
    assert.equal(matchesAttachmentType(Buffer.from(header!), type!), true);
  }
  assert.equal(matchesAttachmentType(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), "audio/webm"), true);
  assert.equal(matchesAttachmentType(Buffer.from([255, 241]), "audio/aac"), true);
  assert.equal(matchesAttachmentType(Buffer.from("RIFF1234WEBP"), "audio/wav"), false);
});
test("Audio byte ranges support seeking, suffixes and complete reads", () => {
  assert.equal(attachmentRange(undefined, 100), undefined);
  assert.deepEqual(attachmentRange("bytes=0-9", 100), { start: 0, end: 9 });
  assert.deepEqual(attachmentRange("bytes=95-", 100), { start: 95, end: 99 });
  assert.deepEqual(attachmentRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.deepEqual(attachmentRange("bytes=0-999", 100), { start: 0, end: 99 });
  for (const value of ["bytes=100-", "bytes=8-2", "bytes=-0", "bytes=-", "bytes=a-b", "bytes=0-2,4-6", "bytes=9999999999999999999999-"]) {
    assert.equal(attachmentRange(value, 100), null, value);
  }
});
test("Uploaded names cannot inject HTTP headers or path separators", () => {
  assert.equal(safeAttachmentName("../Cliente\\arquivo\r\n.pdf"), ".._Cliente_arquivo__.pdf");
  assert.equal(safeAttachmentName(" Atualização do cliente.pdf "), "Atualização do cliente.pdf");
});
