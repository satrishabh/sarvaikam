package com.sarvaikam.content.api;

import com.sarvaikam.content.service.ReelService;
import com.sarvaikam.content.service.ReelService.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import java.util.List;

@RestController
@Validated
public class ReelController {
    private final ReelService service;
    public ReelController(ReelService service) { this.service = service; }
    @GetMapping("/reels")
    public List<ReelView> feed(@RequestParam(defaultValue="20") @Min(1) @Max(100) int limit,
                               @RequestParam(defaultValue="0") @Min(0) int offset) { return service.list(false, limit, offset); }
    @GetMapping("/admin/reels")
    public List<ReelView> drafts(@RequestParam(defaultValue="100") @Min(1) @Max(100) int limit,
                                 @RequestParam(defaultValue="0") @Min(0) int offset) { return service.list(true, limit, offset); }
    @PutMapping("/admin/reels")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void save(@Valid @RequestBody ReelRequest request) { service.save(request); }
    @DeleteMapping("/admin/reels/{slug}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String slug) { service.delete(slug); }
}
