import { NextRequest, NextResponse } from 'next/server';
import { vlmImageAnalysis, structuredLLMAnalysis, bufferToDataUrl, getModelLabel } from '@/lib/ai';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    let imageUrl: string | null = null;
    let fileName = 'reverse-image-search';
    let fileSize = 0;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const imageFile = formData.get('image') as File | null;
      if (!imageFile) {
        return NextResponse.json(
          { error: 'No image file provided' },
          { status: 400 }
        );
      }
      fileName = imageFile.name;
      fileSize = imageFile.size;
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      imageUrl = bufferToDataUrl(buffer, imageFile.type);
    } else {
      // Handle URL input
      const body = await request.json();
      if (!body.url) {
        return NextResponse.json(
          { error: 'No image URL provided' },
          { status: 400 }
        );
      }
      imageUrl = body.url;
      fileName = `url-${Date.now()}`;
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Step 1: Use VLM to describe the image
    let imageDescription = '';
    let visualFeatures: string[] = [];
    try {
      const vlmResult = await vlmImageAnalysis(
        imageUrl,
        `Analyze this image in detail. Provide:
1. A comprehensive description of what is shown in the image
2. Key visual features, objects, people, text, or landmarks visible
3. Any signs of manipulation, editing, or AI-generation

Respond in JSON format:
{
  "description": "detailed description of the image",
  "visualFeatures": ["feature1", "feature2", "feature3"],
  "manipulationIndicators": ["indicator1", "indicator2"],
  "aiGeneratedLikelihood": 0-100
}`
      );
      imageDescription = typeof vlmResult.description === 'string' ? vlmResult.description : 'Image analysis completed';
      visualFeatures = Array.isArray(vlmResult.visualFeatures) ? vlmResult.visualFeatures : [];
    } catch (error) {
      console.error('VLM analysis error:', error);
      imageDescription = 'Unable to analyze image with vision model. Proceeding with web search.';
    }

    // Step 2: Use web search to find similar images
    let searchResults: Array<{ title?: string; url?: string; snippet?: string }> = [];
    try {
      const { webSearch } = await import('@/lib/ai');
      const searchQuery = imageDescription
        ? `"${imageDescription.slice(0, 200)}" image source OR origin OR original`
        : 'reverse image search similar images';

      // Uses the configured search provider (Tavily/Brave); returns [] if none set.
      searchResults = await webSearch(searchQuery, 10);
    } catch (error) {
      console.error('Web search error:', error);
    }

    // Step 3: Use LLM to analyze search results
    let contextAnalysis = '';
    let manipulationLikelihood = 50;
    let authenticityScore = 50;
    let similarImages: Array<{ source: string; url: string; title: string; relevance: string }> = [];

    try {
      const searchContext = searchResults.slice(0, 8).map((r, i) =>
        `Result ${i + 1}: ${r.title || 'No title'} - ${r.snippet || 'No snippet'} (${r.url || 'No URL'})`
      ).join('\n');

      const analysisResult = await structuredLLMAnalysis(
        `You are an expert digital media verification analyst specializing in reverse image search and image authenticity assessment. Based on the image description and web search results, provide a comprehensive analysis.`,
        `Image description: ${imageDescription}
Visual features: ${visualFeatures.join(', ')}

Web search results for similar images:
${searchContext || 'No search results found.'}

Analyze these results and provide:
1. Where has this image or similar images appeared before?
2. Is there evidence this image has been manipulated or used in misleading contexts?
3. What is the likelihood of manipulation?
4. An authenticity trust score (0-100)

Respond in JSON:
{
  "contextAnalysis": "detailed analysis of where the image has appeared and how it has been used",
  "manipulationLikelihood": 0-100,
  "authenticityScore": 0-100,
  "similarImages": [{"source": "site name", "url": "url", "title": "title", "relevance": "high/medium/low"}],
  "warnings": ["warning1", "warning2"],
  "recommendations": ["rec1", "rec2"]
}`
      );

      contextAnalysis = typeof analysisResult.contextAnalysis === 'string'
        ? analysisResult.contextAnalysis
        : 'Analysis completed but detailed context is unavailable.';
      manipulationLikelihood = typeof analysisResult.manipulationLikelihood === 'number'
        ? Math.max(0, Math.min(100, analysisResult.manipulationLikelihood))
        : 50;
      authenticityScore = typeof analysisResult.authenticityScore === 'number'
        ? Math.max(0, Math.min(100, analysisResult.authenticityScore))
        : 50;
      similarImages = Array.isArray(analysisResult.similarImages)
        ? analysisResult.similarImages.map((img: Record<string, unknown>) => ({
            source: String(img.source || 'Unknown'),
            url: String(img.url || '#'),
            title: String(img.title || 'Related result'),
            relevance: String(img.relevance || 'medium'),
          }))
        : [];
    } catch (error) {
      console.error('LLM analysis error:', error);
      contextAnalysis = 'Unable to perform detailed context analysis due to a processing error. The image has been described but search result analysis was limited.';
    }

    const processingTime = Date.now() - startTime;

    // Save to database
    try {
      const mediaUpload = await db.mediaUpload.create({
        data: {
          fileName,
          fileType: 'image',
          mimeType: 'image/jpeg',
          fileSize,
          status: 'completed',
        },
      });

      await db.analysisReport.create({
        data: {
          mediaUploadId: mediaUpload.id,
          analysisType: 'image_reverse_search',
          status: 'completed',
          results: JSON.stringify({
            imageDescription,
            searchResults: searchResults.slice(0, 5),
            contextAnalysis,
            manipulationLikelihood,
            authenticityScore,
            similarImages,
          }),
          trustScore: authenticityScore,
          riskLevel: manipulationLikelihood > 70 ? 'high' : manipulationLikelihood > 40 ? 'medium' : 'low',
          aiModel: getModelLabel(),
          processingTime,
          explanation: contextAnalysis,
          confidence: authenticityScore / 100,
          recommendations: JSON.stringify(['Verify the original source of this image', 'Cross-reference with fact-checking databases']),
        },
      });
    } catch (dbError) {
      console.error('Database save error:', dbError);
    }

    return NextResponse.json({
      success: true,
      results: {
        imageDescription,
        visualFeatures,
        searchResults: searchResults.slice(0, 8),
        contextAnalysis,
        manipulationLikelihood,
        authenticityScore,
        similarImages,
      },
      processingTime,
    });
  } catch (error) {
    console.error('Reverse image search error:', error);
    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to perform reverse image search',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      },
      { status: 500 }
    );
  }
}
