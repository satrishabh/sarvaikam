package com.sarvaikam.content.api;

import com.sarvaikam.content.service.AssetService;
import com.sarvaikam.content.service.AssetService.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
public class AssetController {
    private final AssetService assets;
    public AssetController(AssetService assets) { this.assets = assets; }
    @GetMapping("/lessons/{lessonId}/assets")
    public List<AssetView> list(@PathVariable long lessonId) { return assets.list(lessonId); }
    @PostMapping("/admin/lessons/{lessonId}/assets/upload")
    public UploadView upload(@PathVariable long lessonId, @Valid @RequestBody UploadRequest r) { return assets.upload(lessonId, r); }
    @PostMapping("/admin/assets/{id}/complete")
    public AssetView complete(@PathVariable UUID id) { return assets.complete(id); }
    @GetMapping("/assets/{id}/download")
    public DownloadView download(@PathVariable UUID id) { return assets.download(id); }
    @DeleteMapping("/admin/assets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) { assets.delete(id); }
}
