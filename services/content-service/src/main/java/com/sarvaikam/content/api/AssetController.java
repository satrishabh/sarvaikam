package com.sarvaikam.content.api;

import com.sarvaikam.content.service.AssetService;
import com.sarvaikam.content.service.AssetService.*;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
public class AssetController {
    private final AssetService assets;
    public AssetController(AssetService assets) { this.assets = assets; }
    @GetMapping("/lessons/{lessonId}/assets")
    public List<AssetView> list(@PathVariable long lessonId) { return assets.list(lessonId); }
    @PostMapping("/admin/lessons/{lessonId}/assets/upload")
    public UploadView upload(@PathVariable long lessonId, @Valid @RequestBody UploadRequest r,
                             @RequestHeader(value = HttpHeaders.ORIGIN, required = false) String origin) { return assets.upload(lessonId, r, origin); }
    @PostMapping("/admin/assets/{id}/complete")
    public AssetView complete(@PathVariable UUID id) { return assets.complete(id); }
    @GetMapping("/assets/{id}/download")
    public DownloadView download(@PathVariable UUID id) { return assets.download(id); }
    /** Signed, short-lived link for storage backends without direct download URLs (Google Drive). */
    @GetMapping("/assets/{id}/file")
    public ResponseEntity<StreamingResponseBody> file(@PathVariable UUID id, @RequestParam long expires, @RequestParam String signature) throws IOException {
        FileStream file = assets.stream(id, expires, signature);
        StreamingResponseBody body = out -> { try (var in = file.body()) { in.transferTo(out); } };
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .contentLength(file.size())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(file.filename(), StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .header("X-Content-Type-Options", "nosniff")
                .body(body);
    }
    @DeleteMapping("/admin/assets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) { assets.delete(id); }
}
