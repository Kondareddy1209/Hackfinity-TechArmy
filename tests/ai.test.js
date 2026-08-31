describe('AI Services Unit Tests (Mocked - Zero API Usage)', () => {
    afterEach(() => {
        jest.resetModules();
        jest.restoreAllMocks();
    });

    describe('Gemini Agent Service', () => {
        it('should return configuration error message when GOOGLE_API_KEY is missing', async () => {
            const originalKey = process.env.GOOGLE_API_KEY;
            delete process.env.GOOGLE_API_KEY;

            const geminiAgent = require('../services/geminiAgent');
            const result = await geminiAgent.generateProductDescription('Eco Water Bottle', 'steel, reusable');
            expect(result).toContain('AI agent not configured');

            process.env.GOOGLE_API_KEY = originalKey;
        });

        it('should generate product description when Gemini SDK returns content', async () => {
            process.env.GOOGLE_API_KEY = 'mock_google_key';

            jest.doMock('@google/generative-ai', () => {
                return {
                    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
                        getGenerativeModel: jest.fn().mockReturnValue({
                            generateContent: jest.fn().mockResolvedValue({
                                response: {
                                    text: () => 'Premium eco-friendly stainless steel bottle designed for everyday hydration.'
                                }
                            })
                        })
                    }))
                };
            });

            const geminiAgent = require('../services/geminiAgent');
            const result = await geminiAgent.generateProductDescription('Eco Bottle', 'stainless, green', 'Professional', 'English');
            expect(result).toEqual('Premium eco-friendly stainless steel bottle designed for everyday hydration.');
        });

        it('should attempt fallback model if primary model fails', async () => {
            process.env.GOOGLE_API_KEY = 'mock_google_key';

            let callCount = 0;
            jest.doMock('@google/generative-ai', () => {
                return {
                    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
                        getGenerativeModel: jest.fn().mockImplementation(({ model }) => {
                            callCount++;
                            if (model === 'gemini-1.5-flash') {
                                return {
                                    generateContent: jest.fn().mockRejectedValue(new Error('Model not available'))
                                };
                            }
                            return {
                                generateContent: jest.fn().mockResolvedValue({
                                    response: {
                                        text: () => 'Fallback description generated successfully.'
                                    }
                                })
                            };
                        })
                    }))
                };
            });

            const geminiAgent = require('../services/geminiAgent');
            const result = await geminiAgent.generateProductDescription('Test Product', 'test');
            expect(result).toEqual('Fallback description generated successfully.');
            expect(callCount).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Groq Agent Service', () => {
        it('should return configuration error message when GROQ_API_KEY is missing', async () => {
            const originalKey = process.env.GROQ_API_KEY;
            delete process.env.GROQ_API_KEY;

            const groqAgent = require('../services/groqAgent');
            const result = await groqAgent.getGroqChatCompletion('Hello AI');
            expect(result).toContain('Groq AI agent not configured');

            process.env.GROQ_API_KEY = originalKey;
        });

        it('should return text response when Groq SDK generates completion', async () => {
            process.env.GROQ_API_KEY = 'mock_groq_key';

            jest.doMock('groq-sdk', () => {
                return jest.fn().mockImplementation(() => ({
                    chat: {
                        completions: {
                            create: jest.fn().mockResolvedValue({
                                choices: [{ message: { content: 'Hello! I am your AI eCommerce assistant.' } }]
                            })
                        }
                    }
                }));
            });

            const groqAgent = require('../services/groqAgent');
            const result = await groqAgent.getGroqChatCompletion('Hello!');
            expect(result).toEqual('Hello! I am your AI eCommerce assistant.');
        });

        it('should parse JSON when returnJson is requested', async () => {
            process.env.GROQ_API_KEY = 'mock_groq_key';

            jest.doMock('groq-sdk', () => {
                return jest.fn().mockImplementation(() => ({
                    chat: {
                        completions: {
                            create: jest.fn().mockResolvedValue({
                                choices: [{ message: { content: '{"status":"ok","category":"Electronics"}' } }]
                            })
                        }
                    }
                }));
            });

            const groqAgent = require('../services/groqAgent');
            const result = await groqAgent.getGroqChatCompletion('Categorize this', true);
            expect(result).toEqual({ status: 'ok', category: 'Electronics' });
        });
    });
});
