package com.sarvaikam.content.service;

import java.util.regex.Pattern;

/** Markdown to the plain text that full-text search indexes: words stay, markup and URLs go. Code is kept. */
public final class SearchText {
    static final int MAX_CHARS = 200_000;
    private static final Pattern IMAGE = Pattern.compile("!\\[([^\\]]*)]\\([^)]*\\)");
    private static final Pattern LINK = Pattern.compile("\\[([^\\]]*)]\\([^)]*\\)");
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]{1,200}>");
    private static final Pattern URL = Pattern.compile("https?://\\S+");
    private static final Pattern FENCE = Pattern.compile("(?m)^\\s*(```|~~~)\\S*\\s*$");
    private static final Pattern TABLE_RULE = Pattern.compile("(?m)^\\s*\\|?\\s*:?-{3,}.*$");
    private static final Pattern LINE_MARKUP = Pattern.compile("(?m)^\\s{0,3}(#{1,6}\\s+|>\\s?|[-*+]\\s+|\\d+[.)]\\s+)");
    private static final Pattern INLINE_MARKUP = Pattern.compile("[*_`|~]+");
    private static final Pattern SPACE = Pattern.compile("\\s+");

    private SearchText() {}

    public static String plain(String markdown) {
        if (markdown == null || markdown.isBlank()) return "";
        String text = IMAGE.matcher(markdown).replaceAll("$1");
        text = LINK.matcher(text).replaceAll("$1");
        text = HTML_TAG.matcher(text).replaceAll(" ");
        text = URL.matcher(text).replaceAll(" ");
        text = FENCE.matcher(text).replaceAll(" ");
        text = TABLE_RULE.matcher(text).replaceAll(" ");
        text = LINE_MARKUP.matcher(text).replaceAll("");
        text = INLINE_MARKUP.matcher(text).replaceAll(" ");
        text = SPACE.matcher(text).replaceAll(" ").trim();
        return text.length() > MAX_CHARS ? text.substring(0, MAX_CHARS) : text;
    }
}
