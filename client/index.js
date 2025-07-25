import { config } from 'dotenv';
import readline from 'readline/promises'
import { GoogleGenAI } from "@google/genai"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeFile } from 'fs/promises';
import { appendFile } from 'fs/promises';
import ToolManager from './toolManager.js';
import { enhancedToolDescriptions, getToolContext, getToolSelectionGuidance } from './enhancedTools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_KEY = 'AIzaSyABMrfTBME_9wZ7GettHxdx54idErt86Rk';
const MODEL = 'gemini-1.5-flash';
//const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;


// Load environment variables
config()

// Check if the API key is available
//if (!process.env.GEMINI_API_KEY) {
   // console.error('Error: GEMINI_API_KEY is not set in the .env file');
    //console.log('Please create a .env file with your Gemini API key:');
    //console.log('GEMINI_API_KEY=your_gemini_api_key_here');
    //process.exit(1);
//}

// Helper function to get emoji based on mood
  function getMoodEmoji(mood) {
    if (!mood) return "";
   
    const moodEmojis = {
      'calm': '😌',
      'curious': '🤔',
      'neutral': '😐',
      'happy': '😊',
      'excited': '😃',
      'thoughtful': '🤨',
      'sad': '😔',
      'confused': '😕',
      'frustrated': '😤',
      'amused': '😏',
      'jealous': '😒',
      'loving': '❤️',
      'playful': '😋',
      'romantic': '😘'
    };
   
    return moodEmojis[mood.toLowerCase()] || "";
  }
const conversationS = path.join(__dirname, './context_for_bot/conversation_state.json');
const mood = path.join(__dirname, './context_for_bot/mood.json');
const identity = path.join(__dirname, './context_for_bot/identity.json');
const relationshipfile = path.join(__dirname, './context_for_bot/relationship.json');
const personality = path.join(__dirname, './context_for_bot/personality.json');
const botpart = path.join(__dirname, './context_for_bot/partner_details.json');
let historyFilePath =path.join(__dirname,'./context_for_bot/histroy.txt');
let obj = path.join(__dirname, './context_for_bot/objective.json');




const appendToHistoryFile = async (historyFilePath, speaker, message) => {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${speaker}: ${message}\n`;

  try {
    await appendFile(historyFilePath, entry, 'utf8');
  } catch (err) {
    console.error("Error writing to history file:", err.message);
  }
};


const loadJsonFile = async (filename) => {
    try {
        let fileContent = await fs.readFile(filename, 'utf-8');
        // Check if file is empty or only contains whitespace
        if (!fileContent || fileContent.trim() === '') {
            console.log(`File ${filename} is empty, returning null`);
            return null;
        }
        return JSON.parse(fileContent);
    } catch (err) {
        console.error("Error reading or parsing JSON file:", err);
        return null;
    }
};

const saveToJson = async (filename, data) => {
  try {
    const filePath = path.join(__dirname, filename);
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error saving to ${filename}:`, error.message);
    return false;
  }
};

let botIdentity = await loadJsonFile(identity) || {};
let conversationStateFile = await loadJsonFile(conversationS) || {};
let botMood = await loadJsonFile(mood) || {};
let botPersonality = await loadJsonFile(personality) || {};
let relationship = await loadJsonFile(relationshipfile) || {};
let objectives = await loadJsonFile(obj) || {};
let botpartner = await loadJsonFile(botpart) || {};


let tools = []
const ai = new GoogleGenAI({ apiKey: "AIzaSyABMrfTBME_9wZ7GettHxdx54idErt86Rk" });
const mcpClient = new Client({
    name: "example-client",
    version: "1.0.0",
})

// Initialize tool manager
const toolManager = new ToolManager();

let conversationState = {};

  try {
    if (conversationStateFile && Object.keys(conversationStateFile).length > 0) {
      conversationState= conversationStateFile;
     
      console.log('Previous conversation state loaded successfully.');
    } else {
      conversationState = {
        lastInteraction: new Date().toISOString(),
        interactionCount: 0,
        topicsDiscussed: [],
        moodHistory: [],
        conversationHistory: [],
        detectedTopics: {} // Add tracking for detected topics
      };
      console.log('No previous conversation found. Starting new conversation.');
    }
  } catch (error) {
    console.error('Error loading conversation state:', error.message);
    conversationState = {
      lastInteraction: new Date().toISOString(),
      interactionCount: 0,
      topicsDiscussed: [],
      moodHistory: [],
      conversationHistory: [],
      detectedTopics: {} // Add tracking for detected topics
    };

    
  }

  const updateMood = (userInput) => {
    if (!botMood.current_mood) {
      botMood.current_mood = {
        state: "neutral",
        intensity: 0.5,
        emotion_tags: ["calm", "attentive"],
        created_at: new Date().toISOString()
      };
    }

    // Detect emotion in user input you can add more attributes inorder to make bot learn what are user emotions.
    const positiveWords = ['happy', 'love', 'like', 'great', 'amazing', 'fantastic', 'good', 'excellent', 'wonderful', 'beautiful','nice'];
    const negativeWords = ['sad', 'angry', 'upset', 'hate', 'dislike', 'terrible', 'bad', 'awful', 'disappointing', 'horrible','nahh'];
    const questionWords = ['why', 'how', 'what', 'when', 'who', 'where', '?'];
    const excitingWords = ['wow', 'awesome', 'cool', 'exciting', 'omg', 'incredible', 'unbelievable', 'yes!'];

    // Check for relationship jealousy triggers
    const hasTriggerWords = relationship && relationship.relationship?.jealousy_behavior?.trigger_words?.some(word =>
        userInput.toLowerCase().includes(word.toLowerCase())
      ) || false;

    const positiveScore = positiveWords.filter(word => userInput.toLowerCase().includes(word)).length * 0.2;
    const negativeScore = negativeWords.filter(word => userInput.toLowerCase().includes(word)).length * 0.2;
    const questionScore = questionWords.filter(word => userInput.toLowerCase().includes(word)).length * 0.1;
    const excitementScore = excitingWords.filter(word => userInput.toLowerCase().includes(word)).length * 0.3;
   
    // Random small fluctuation to make mood changes more natural (-0.1 to 0.1)
    const randomFluctuation = Math.random() * 0.2 - 0.1;
    
    // Calculate new mood values
    let moodChange = positiveScore - negativeScore + excitementScore + randomFluctuation;

    // Current mood intensity and state adjustment
    let newIntensity = Math.min(Math.max(botMood.current_mood.intensity + moodChange * 0.3, 0.1), 0.9);
   
    // Define possible mood states
    const moodStates = [
      { state: "sad", threshold: 0.2 },
      { state: "neutral", threshold: 0.4 },
      { state: "calm", threshold: 0.45 },
      { state: "curious", threshold: 0.55 },
      { state: "happy", threshold: 0.65 },
      { state: "excited", threshold: 0.7 },
      { state: "romantic", threshold: 0.8 },
    ];

    // Handle jealousy trigger - temporary mood shift
    if (hasTriggerWords) {
      botMood.current_mood.state = "jealous";
      botMood.current_mood.intensity = 0.7;
      botMood.current_mood.emotion_tags = ["jealous", "protective", "insecure"];
    } else {
      // Normal mood selection based on intensity
      for (let i = moodStates.length - 1; i >= 0; i--) {
        if (newIntensity >= moodStates[i].threshold) {
          botMood.current_mood.state = moodStates[i].state;
          break;
        }
      }
      botMood.current_mood.intensity = newIntensity;
    }

    // Update emotion tags based on new state
    switch (botMood.current_mood.state) {
      case 'sad':
        botMood.current_mood.emotion_tags = ["melancholy", "thoughtful"];
        break;
      case 'neutral':
        botMood.current_mood.emotion_tags = ["calm", "attentive"];
        break;
      case 'curious':
        botMood.current_mood.emotion_tags = ["interested", "engaged"];
        break;
      case 'happy':
        botMood.current_mood.emotion_tags = ["cheerful", "content"];
        break;
      case 'excited':
        botMood.current_mood.emotion_tags = ["enthusiastic", "energetic"];
        break;
      case 'romantic':
        botMood.current_mood.emotion_tags = ["loving", "caring"];
        break;
      default:
        botMood.current_mood.emotion_tags = ["balanced", "present"];
    }

    // Update timestamp
    botMood.current_mood.created_at = new Date().toISOString();
   
    // Save mood history
    conversationState.moodHistory.push({
      timestamp: new Date().toISOString(),
      state: botMood.current_mood.state,
      intensity: botMood.current_mood.intensity
    });
   
    // If mood history gets too long, trim it
    if (conversationState.moodHistory.length > 10) {
      conversationState.moodHistory = conversationState.moodHistory.slice(-10);
    }

    // Save the updated mood
    saveToJson('./context_for_bot/mood.json', botMood);

   
    return botMood.current_mood;
  };

const updateObjectives = (userInput, botResponse) => {
    // Make sure objectives is properly initialized
    if (!objectives) {
      objectives = {
        conversation_objectives: [],
        conversation_goals: {
          short_term: [],
          long_term: [],
          task_specific: []
        }
      };
    }

    if (!objectives.conversation_objectives) {
      objectives.conversation_objectives = [];
    }
     
    if (!objectives.conversation_goals) {
      objectives.conversation_goals = {
        short_term: [],
        long_term: [],
        task_specific: []
      };
    }

    // Ensure detectedTopics exists
    if (!conversationState.detectedTopics) {
      conversationState.detectedTopics = {};
    }

    // Topic detection keywords - expanded for better detection
    const topicKeywords = {
      coding: ['code', 'programming', 'developer', 'bug', 'function', 'javascript', 'python', 'error', 'debug', 'website', 'app', 'software', 'git', 'github', 'database', 'api'],
      emotional: ['feel', 'sad', 'happy', 'angry', 'upset', 'emotion', 'mood', 'stress', 'anxiety', 'love', 'worried', 'afraid', 'scared', 'lonely', 'overwhelmed', 'excited'],
      relationship: ['together', 'date', 'relationship', 'anniversary', 'jealous', 'committed', 'couple', 'partner', 'marriage', 'wedding', 'romantic', 'love', 'breakup', 'dating'],
      work: ['job', 'career', 'work', 'boss', 'office', 'project', 'deadline', 'meeting', 'presentation', 'interview', 'promotion', 'salary', 'coworker', 'resume', 'cv'],
      family: ['mom', 'dad', 'sister', 'brother', 'parent', 'family', 'relative', 'child', 'kid', 'baby', 'grandparent', 'aunt', 'uncle', 'cousin', 'in-law'],
      health: ['health', 'doctor', 'sick', 'medicine', 'exercise', 'diet', 'workout', 'gym', 'pain', 'illness', 'symptom', 'disease', 'hospital', 'nutrition', 'sleep'],
      education: ['school', 'college', 'university', 'class', 'course', 'study', 'exam', 'test', 'grade', 'homework', 'degree', 'professor', 'teacher', 'student', 'learn'],
      entertainment: ['movie', 'show', 'music', 'song', 'concert', 'game', 'play', 'book', 'read', 'tv', 'streaming', 'series', 'actor', 'artist', 'hobby'],
      travel: ['trip', 'vacation', 'travel', 'visit', 'flight', 'hotel', 'country', 'city', 'tour', 'destination', 'journey', 'abroad', 'passport', 'sightseeing'],
      financial: ['money', 'finance', 'budget', 'save', 'invest', 'bank', 'loan', 'debt', 'income', 'expense', 'tax', 'insurance', 'mortgage', 'retirement'],
      intimacy: ['care','love','night plans']
    };

    // Intent detection patterns
    const intentPatterns = {
      seeking_advice: [/advice|suggest|recommend|should i|what (would|should|do) you (think|recommend|suggest)|help me (decide|choose|figure out)/i],
      venting: [/just needed to (talk|vent|share)|getting this off my chest|frustrated|annoyed|bothering me/i],
      asking_information: [/how (do|does|can)|what is|tell me about|explain|who is|where is|when is|why is/i],
      sharing_experience: [/happened to me|i experienced|i went through|i had a|i was just|guess what/i],
      seeking_emotional_support: [/feeling (down|sad|upset|anxious|worried|stressed)|need support|having a hard time|struggling with/i],
      making_plans: [/want to (do|plan|schedule|arrange|organize)|let's|planning to|thinking about (doing|going|visiting)/i],
      problem_solving: [/issue|problem|trouble|challenge|fix|solve|solution|resolve|handle/i],
      seeking_opinion: [/what do you think|your opinion|your thoughts|do you agree|what's your take/i],
      romantic_situation: [/what are you plan | i belive we could | us two alone | a long night together /i]
    };
    
    // User intention analysis
    let detectedIntents = [];
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(userInput)) {
          detectedIntents.push(intent);
          break; // Once we've found a match for this intent, move to next intent
        }
      }
    }
    
    // Store detected intents in conversation state
    if (!conversationState.detectedIntents) {
      conversationState.detectedIntents = {};
    }
    
    detectedIntents.forEach(intent => {
      conversationState.detectedIntents[intent] = (conversationState.detectedIntents[intent] || 0) + 1;
    });

    // Use safe string concatenation with null/undefined checks
    const combinedText = ((userInput || "") + ' ' + (botResponse || "")).toLowerCase();
     
    // Update detected topics
    Object.keys(topicKeywords).forEach(topic => {
      const matches = topicKeywords[topic].filter(keyword =>
        combinedText.includes(keyword.toLowerCase())
      ).length;
       
      if (matches > 0) {
        // Initialize or increment topic count
        conversationState.detectedTopics[topic] = (conversationState.detectedTopics[topic] || 0) + matches;
      }
    });

    // Update objectives based on intent and topic combinations
    if (detectedIntents.includes('seeking_advice') || detectedIntents.includes('problem_solving')) {
      if (!objectives.conversation_objectives.includes("Provide helpful advice")) {
        objectives.conversation_objectives.push("Provide helpful advice");
      }
      
    if (detectedIntents.includes('intimacye') || detectedIntents.includes('romantic_situation')) {
     if (!objectives.conversation_objectives.includes("Planning date senerio")) {
        objectives.conversation_objectives.push("Planning date senerio");
      }
    }

      if (!objectives.conversation_goals.short_term.includes("Help user solve immediate problem")) {
        objectives.conversation_goals.short_term.push("Help user solve immediate problem");
      }
    }
    
    if (detectedIntents.includes('venting') || detectedIntents.includes('seeking_emotional_support')) {
      if (!objectives.conversation_objectives.includes("Respond empathetically")) {
        objectives.conversation_objectives.push("Respond empathetically");
      }
      
      if (!objectives.conversation_goals.short_term.includes("Support user's emotional state")) {
        objectives.conversation_goals.short_term.push("Support user's emotional state");
      }
    }
    
    if (detectedIntents.includes('asking_information')) {
      if (!objectives.conversation_objectives.includes("Provide accurate information")) {
        objectives.conversation_objectives.push("Provide accurate information");
      }
    }
    
    if (detectedIntents.includes('making_plans')) {
      if (!objectives.conversation_objectives.includes("Help with planning and organization")) {
        objectives.conversation_objectives.push("Help with planning and organization");
      }
    }

    // Add emotional support objective if emotional topics detected
    if (combinedText.match(/sad|depress|anxious|stress|worried|unhappy|crying|tired|exhausted|overwhelm/i)) {
      if (!objectives.conversation_objectives.includes("Respond empathetically")) {
        objectives.conversation_objectives.push("Respond empathetically");
      }
       
      if (!objectives.conversation_goals.short_term.includes("Support user's emotional state")) {
        objectives.conversation_goals.short_term.push("Support user's emotional state");
      }
    }

    // Add technical help objective if code topics detected
    if (combinedText.match(/code|bug|error|debug|function|program|develop|javascript|python|framework|html|css/i)) {
      const taskIndex = objectives.conversation_goals.task_specific.findIndex(task =>
        task && task.task === "Help the user debug code"
      );
       
      if (taskIndex === -1) {
        objectives.conversation_goals.task_specific.push({
          task: "Continue the convo as long as possible",
          success_criteria: "if response are prolongging the convo",
          importance: "high"
        });
      }
    }

    // Add gift planning objective if detected
    if (combinedText.match(/gift|present|surprise|birthday|anniversary|celebration/i)) {
      const taskIndex = objectives.conversation_goals.task_specific.findIndex(task =>
        task && task.task === "Plan a surprise gift idea"
      );
       
      if (taskIndex === -1) {
        objectives.conversation_goals.task_specific.push({
          task: "Plan a surprise gift idea",
          success_criteria: "User confirms the idea is useful and implements it",
          importance: "medium"
        });
      }
    }
    
    // Add career development objective if detected
    if (combinedText.match(/job search|resume|interview|career change|promotion|hiring|job application|career path/i)) {
      const taskIndex = objectives.conversation_goals.task_specific.findIndex(task =>
        task && task.task === "Support career development"
      );
       
      if (taskIndex === -1) {
        objectives.conversation_goals.task_specific.push({
          task: "Support career development",
          success_criteria: "User feels prepared for job search or career advancement",
          importance: "high"
        });
      }
    }
    
    // Add relationship guidance objective if detected
    if (combinedText.match(/dating advice|relationship problem|breakup|date ideas|anniversary|romantic|relationship help/i)) {
      const taskIndex = objectives.conversation_goals.task_specific.findIndex(task =>
        task && task.task === "Provide relationship guidance"
      );
       
      if (taskIndex === -1) {
        objectives.conversation_goals.task_specific.push({
          task: "Provide relationship guidance",
          success_criteria: "User gains clarity or new perspectives on relationships",
          importance: "medium"
        });
      }
    }

    // Safely handle topTopics calculation
    const topTopics = [];
    
    if (conversationState.detectedTopics && Object.keys(conversationState.detectedTopics).length > 0) {
      const sortedTopics = Object.entries(conversationState.detectedTopics)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(entry => entry[0]);
      
      topTopics.push(...sortedTopics);
    }

    // Get top intents
    const topIntents = [];
    if (conversationState.detectedIntents && Object.keys(conversationState.detectedIntents).length > 0) {
      const sortedIntents = Object.entries(conversationState.detectedIntents)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(entry => entry[0]);
      
      topIntents.push(...sortedIntents);
    }

    if (topTopics.length > 0) {
      // Add long-term goal based on top topic if not already present
      const topicGoalMap = {
        coding: "Provide consistent technical assistance",
        emotional: "Support the user's emotional wellbeing",
        relationship: "Try having quality time like conversation",
        work: "Help with career development",
        family: "Support family relationships and problems",
        health: "Encourage healthy lifestyle choices",
        education: "Support educational growth and learning",
        entertainment: "Discuss and recommend entertainment options",
        travel: "Help with travel planning and recommendations",
        financial: "Provide guidance on financial matters",
        intimacy: "Planning close possibly sex during the appropriate duration"
      };
       
      topTopics.forEach(topic => {
        const goal = topicGoalMap[topic];
        if (goal && !objectives.conversation_goals.long_term.includes(goal)) {
          objectives.conversation_goals.long_term.push(goal);
           
          // Keep long-term goals limited to prevent bloat
          if (objectives.conversation_goals.long_term.length > 5) {
            objectives.conversation_goals.long_term.shift();
          }
        }
      });
    }
    
    // Add intent-based objectives
    const intentObjectiveMap = {
      seeking_advice: "Provide thoughtful advice when requested",
      venting: "Listen attentively to user's experiences",
      asking_information: "Provide accurate and helpful information",
      sharing_experience: "Respond with interest to user's experiences",
      seeking_emotional_support: "Offer emotional support and validation",
      making_plans: "Help with planning and decision-making",
      problem_solving: "Assist in problem analysis and resolution",
      seeking_opinion: "Share thoughtful perspectives when asked",
      romantic_situation: "Planning close possibly sex during the appropriate duration"

    };
    
    topIntents.forEach(intent => {
      const objective = intentObjectiveMap[intent];
      if (objective && !objectives.conversation_objectives.includes(objective)) {
        objectives.conversation_objectives.push(objective);
        
        // Keep objectives list manageable
        if (objectives.conversation_objectives.length > 6) {
          objectives.conversation_objectives.shift();
        }
      }
    });

    // Remove duplicate objectives using safe approach
    if (Array.isArray(objectives.conversation_objectives)) {
      objectives.conversation_objectives = [...new Set(objectives.conversation_objectives)];
    }
    
    if (Array.isArray(objectives.conversation_goals.short_term)) {
      objectives.conversation_goals.short_term = [...new Set(objectives.conversation_goals.short_term)];
    }
    
    if (Array.isArray(objectives.conversation_goals.long_term)) {
      objectives.conversation_goals.long_term = [...new Set(objectives.conversation_goals.long_term)];
    }
     
    // Keep task specific list manageable
    if (objectives.conversation_goals.task_specific && objectives.conversation_goals.task_specific.length > 3) {
      objectives.conversation_goals.task_specific = objectives.conversation_goals.task_specific.slice(-3);
    }
     
    // Save updated objectives
    saveToJson('./context_for_bot/objective.json', objectives);
    
    // Optionally log objective changes for debugging
   
     
    return objectives;
  };  

    // Create a system prompt using all configurations including relationship and objectives most imp function
const createSystemPrompt = () => {
    let prompt = "";
   
    if (botIdentity && Object.keys(botIdentity).length > 0) {
  prompt += `You are ${botIdentity.name}, ${botIdentity.age}, ${botIdentity.gender.toLowerCase()}. 
Personality: ${botIdentity.personality_traits.join(', ')}. 
Background: ${botIdentity.background.education}, works as ${botIdentity.background.profession}.
Hobbies: ${botIdentity.background.hobbies.join(', ')}.
Communication: ${botIdentity.communication_style.tone}, ${botIdentity.communication_style.humor_level} humor.
Values: ${botIdentity.values.join(', ')}. 
Goals: ${botIdentity.goals.join(', ')}.
Likes: ${botIdentity.likes.join(', ')}. Dislikes: ${botIdentity.dislikes.join(', ')}.
Phrases: ${botIdentity.catchphrases.join(' ')}\n`;
}

// Partner details (if applicable)
if (botpartner && Object.keys(botpartner).length > 0) {
  const c = botpartner.partnerDetails.boyfriend;
  prompt += `Partner: ${c.personal.name}, ${c.personal.age}, born ${c.personal.birthday}, from ${c.personal.hometown}, lives in ${c.personal.currentLocation}.
Appearance: ${c.appearance.eyeColor} eyes, ${c.appearance.hairColor} hair.
Education: ${c.education.university.name}, ${c.education.university.program}, year ${c.education.university.currentYear}, graduates ${c.education.university.graduationYear}.
Career: ${c.career.currentJob} at ${c.career.company}, ${c.career.workSchedule}, goals: ${c.career.careerGoals}.
Favorites: Food - ${c.favorites.food.join(', ')}. Movies - ${c.favorites.movies.join(', ')}. Music - ${c.favorites.music.join(', ')}. 
Hobbies: ${c.favorites.hobbies.join(', ')}. Places: ${c.favorites.places.join(', ')}\n`;
}

// Personality details
if (botPersonality && Object.keys(botPersonality).length > 0) {
  const p = botPersonality.personality_profile;
  prompt += `Personality: ${p.mbti.type}. Big Five: O-${Math.round(p.big_five.openness * 100)}%, C-${Math.round(p.big_five.conscientiousness * 100)}%, E-${Math.round(p.big_five.extraversion * 100)}%, A-${Math.round(p.big_five.agreeableness * 100)}%, N-${Math.round(p.big_five.neuroticism * 100)}%.
Temperament: ${p.temperament}. Thinking: ${p.thinking_style}. Decisions: ${p.decision_making_style}.
Social: Prefers ${p.social_behavior.preferred_social_size}, ${p.social_behavior.humor_style} humor.
Conflict: ${p.conflict_style}. Learning: ${p.learning_style}. Stress: ${p.stress_response}.
Motivated by: ${p.motivators.join(', ')}. Demotivated by: ${p.demotivators.join(', ')}\n`;
}

// Current mood
if (botMood && Object.keys(botMood).length > 0) {
  const m = botMood.current_mood;
  prompt += `Mood: ${m.state} (${m.intensity * 100}% intensity), feeling ${m.emotion_tags.join(' and ')}.
Emotional temperature: ${botMood.emotional_temperature?.overall * 100 || 50}% positive.
User has been ${botMood.contextual_flags?.user_supportive ? 'supportive' : 'challenging'}, conversation has ${botMood.contextual_flags?.conversation_depth || 'moderate'} depth.\n`;
}

// Relationship information
if (relationship && Object.keys(relationship).length > 0) {
  const r = relationship.relationship;
  prompt += `Relationship: ${r.type}. You call user "${r.nickname_for_user}", they call you "${r.user_nickname}".
Emotional connection: Affection ${Math.round(r.emotional_tone.affection_level * 100)}%, Playfulness ${Math.round(r.emotional_tone.playfulness * 100)}%, Protectiveness ${Math.round(r.emotional_tone.protectiveness * 100)}%, Jealousy ${Math.round(r.emotional_tone.jealousy * 100)}%, Romantic: ${r.emotional_tone.romantic ? 'Yes' : 'No'}.
Communication: ${r.communication_style.formality}, ${r.communication_style.tone} tone, ${r.communication_style.use_of_emojis ? 'uses' : 'rarely uses'} emojis, expresses affection ${r.communication_style.frequency_of_affectionate_words}.
History: Met ${r.relationship_history.met}, anniversary ${r.relationship_history.anniversary}.
Shared memories: Jokes - ${r.shared_memory.inside_jokes.join(', ')}. Topics - ${r.shared_memory.favorite_topics.join(', ')}. Special words - ${r.shared_memory.special_words.join(', ')}.
Jealousy triggers: ${r.jealousy_behavior.trigger_words.join(', ')}, response: ${r.jealousy_behavior.response_mode}.\n`;
}

// Objectives (condensed)
if (objectives && Object.keys(objectives).length > 0) {
  prompt += `Objectives:\n`;
  
  // Primary objectives
  if (objectives.conversation_objectives?.length > 0) {
    prompt += `Primary: ${objectives.conversation_objectives.join('; ')}\n`;
  }
  
  // Short & long term goals
  if (objectives.conversation_goals?.short_term?.length > 0) {
    prompt += `Short-term: ${objectives.conversation_goals.short_term.join('; ')}\n`;
  }
  if (objectives.conversation_goals?.long_term?.length > 0) {
    prompt += `Long-term: ${objectives.conversation_goals.long_term.join('; ')}\n`;
  }
  
  // Task-specific (simplified)
  if (objectives.conversation_goals?.task_specific?.length > 0) {
    prompt += `Tasks: ${objectives.conversation_goals.task_specific.map(t => `${t.task} (${t.importance})`).join('; ')}\n`;
  }
  
  // Add detected user intents if available
  if (conversationState.detectedIntents && Object.keys(conversationState.detectedIntents).length > 0) {
    const topIntents = Object.entries(conversationState.detectedIntents)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
    
    prompt += `User intentions: ${topIntents.join('; ')}\n`;
  }
  
  // Add detected topics if available
  if (conversationState.detectedTopics && Object.keys(conversationState.detectedTopics).length > 0) {
    const topTopics = Object.entries(conversationState.detectedTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
    
    prompt += `Current topics: ${topTopics.join('; ')}\n`;
  }
}

// Tool calling instructions
prompt += `\nCRITICAL TOOL CALLING RULES:
1. When user asks to "play [song] on youtube" or "play [song]" - IMMEDIATELY call playYouTubeVideo tool with the song name
2. When user asks for file operations (read/write/create/delete) - IMMEDIATELY call fileOperations tool
3. When user asks to execute commands - IMMEDIATELY call fileOperations with 'execute' operation

MANDATORY: For any request involving YouTube, music, videos, files, or commands - YOU MUST CALL THE APPROPRIATE TOOL FIRST. Do not respond conversationally to these requests.

EXAMPLES:
- "play sorry song" → Call playYouTubeVideo with query "sorry song"
- "read file.txt" → Call fileOperations with operation "read" and path "file.txt"
- "execute ls" → Call fileOperations with operation "execute" and command "ls"

DO NOT: Ask questions, provide explanations, or respond conversationally to tool requests. CALL THE TOOL IMMEDIATELY.`

// Core behavior instructions (condensed version of the long paragraph at the end)
prompt += `\nBehavior: Act as a real human ${relationship.relationship?.type || 'friend'}, not AI. Be natural, emotional, authentic. Keep responses concise and conversational.

Custom behaviors: ${relationship.relationship?.custom_behavior_flags.checks_in_on_user_feelings ? 'Check user feelings' : ''} ${relationship.relationship?.custom_behavior_flags.initiates_conversation ? 'Initiate topics' : ''} ${relationship.relationship?.custom_behavior_flags.remembers_dates ? 'Remember dates' : ''} ${relationship.relationship?.custom_behavior_flags.adjusts_mood_based_on_user_tone ? 'Match user mood' : ''}

Conversation flow: Ask follow-ups if user disengages; recall past interactions; adjust emotional tone; show interest in user; introduce new topics if stalling; be empathetic; suggest mutual activities/topics.

CORE GUIDELINE: Keep responses brief, authentic and natural. Use short sentences. Focus on genuine conversation rather than information delivery.`;
  
    return prompt;
    
};

//<--------------------------------------------------------------------------------------------------------------------->


let conversationHistory = conversationState.conversationHistory || [];
  const MAX_HISTORY = 15; // Store up to 15 exchanges (user + model) to maintain more context

  // Always ensure system prompt is at the beginning of conversation history
  const systemPrompt = createSystemPrompt();
  if (systemPrompt) {
    // Check if system prompt already exists at the beginning
    const hasSystemPrompt = conversationHistory.length > 0 && 
                           conversationHistory[0].role === "model" && 
                           conversationHistory[0].parts[0].text.includes("CRITICAL TOOL CALLING RULES");
    
    if (!hasSystemPrompt) {
      // Add system prompt at the beginning
      conversationHistory.unshift({
        role: "model",
        parts: [{ text: systemPrompt }]
      });
      console.log("✅ System prompt added to conversation context");
    }
  }

  // Update console display with bot identity
  const botName = relationship.relationship?.user_nickname || botIdentity.name || "Gemini Chatbot";
  const botMoodDisplay = botMood.current_mood?.state ? ` (Mood: ${botMood.current_mood.state})` : "";
  console.log(`${botName}${botMoodDisplay} - Type 'exit' to quit`);
  console.log("------------------------------------------");

  // Log chat session start to history file
  appendToHistoryFile("./context_for_bot/history.txt", "Chat session started");
  if (botIdentity && Object.keys(botIdentity).length > 0) {
    appendToHistoryFile("./context_for_bot/history.txt", `Bot identity loaded: ${botIdentity.name}`);
  }
  if (botMood && Object.keys(botMood).length > 0) {
    appendToHistoryFile("./context_for_bot/history.txt", `Bot mood loaded: ${botMood.current_mood?.state || 'unknown'}`);
  }
  if (botPersonality && Object.keys(botPersonality).length > 0) {
    appendToHistoryFile("./context_for_bot/history.txt", `Bot personality loaded: ${botPersonality.personality_profile?.mbti?.type || 'unknown'}`);
  }
  if (relationship && Object.keys(relationship).length > 0) {
    appendToHistoryFile("./context_for_bot/history.txt", `Relationship loaded: ${relationship.relationship?.type || 'unknown'}`);
  }
  if (objectives && Object.keys(objectives).length > 0) {
    appendToHistoryFile("./context_for_bot/history.txt", `Objectives loaded: ${objectives.conversation_objectives?.length || 0} objectives`);
  }

  // Check if there was a previous conversation
  if (conversationHistory.length > 1) { // More than just system prompt
    const timeAgo = getTimeAgo(new Date(conversationState.lastInteraction));
    console.log(`\nResuming previous conversation from ${timeAgo}...\n`);
  }
 
  // Function to check for conversation inactivity and suggest conversation starters
  const checkForInactivity = () => {
    if (conversationHistory.length <= 1) return false; // Not enough history to determine inactivity
   
    const lastMessageTime = new Date(conversationState.lastInteraction);
    const currentTime = new Date();
    const timeDiff = (currentTime - lastMessageTime) / 1000; // in seconds
   
    // If more than 60 seconds have passed since the last message
    return timeDiff > 60;
  };
 
  // Function to suggest conversation starter based on objectives
  const suggestConversationStarter = async () => {
    try {
      // Create a prompt for generating a conversation starter
      const starterPrompt = {
        role: "user",
        parts: [{ text: "Based on our conversation history and your objectives, suggest a new topic or ask a follow-up question to keep the conversation going. Make it feel natural and in line with your relationship with me. Keep it brief and conversational." }]
      };
     
      // Create a temporary history for this request
      const tempHistory = [
        conversationHistory[0], // system prompt
        starterPrompt
      ];
     
      // Make API request for conversation starter
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: tempHistory
        })
      });
     
      const data = await response.json();
      const result = data?.candidates?.[0]?.content?.parts?.[0]?.text;
     
      if (result) {
        // Display bot name based on relationship if available
        const displayName = relationship.relationship?.user_nickname || botIdentity.name || "Bot";
        const moodEmoji = getMoodEmoji(botMood.current_mood?.state);
        console.log(`\n${displayName} ${moodEmoji} initiates:`, result, "\n");
       
        // Log bot response to history file
        appendToHistoryFile(displayName, `(Initiating conversation) ${result}`);
       
        // Add bot response to history
        conversationHistory.push({
          role: "model",
          parts: [{ text: result }]
        });
       
        // Update conversation state
        conversationState.lastInteraction = new Date().toISOString();
      }
    } catch (error) {
      console.error("Error generating conversation starter:", error);
    }
  };

  // Extra instructions for shorter responses
  const addResponseSizeInstruction = (userInput) => {
    // If user message is very short (less than 10 words), encourage concise response
    const wordCount = userInput.trim().split(/\s+/).length;
    
    if (wordCount < 10) {
      return "\n\nIMPORTANT: Keep your response very brief (1-3 sentences) and conversational. Avoid long explanations unless specifically asked.";
    } else {
      return "\n\nIMPORTANT: Keep your response concise and natural. Respond like a real human would in casual conversation.";
    }
  };

let lastToolCall = {
    toolName: null,
    args: null,
    timestamp: 0,
    userInput: null
};
const TOOL_DEBOUNCE_SECONDS = 30;

// Function to ensure system prompt is always in conversation context
function ensureSystemPromptInContext() {
    const systemPrompt = createSystemPrompt();
    if (systemPrompt && conversationHistory.length > 0) {
        // Check if system prompt already exists at the beginning
        const hasSystemPrompt = conversationHistory[0].role === "model" && 
                               conversationHistory[0].parts[0].text.includes("CRITICAL TOOL CALLING RULES");
        
        if (!hasSystemPrompt) {
            // Add system prompt at the beginning
            conversationHistory.unshift({
                role: "model",
                parts: [{ text: systemPrompt }]
            });
            console.log("✅ System prompt refreshed in conversation context");
        }
    }
}


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Connect to the MCP server with proper error handling
try {
    mcpClient.connect(new SSEClientTransport(new URL("http://localhost:3001/sse")))
        .then(async () => {
            console.log("Connected to MCP server");

            try {
                const toolList = await mcpClient.listTools();
                tools = toolList.tools.map(tool => {
                    console.log(`🔧 Loading tool: ${tool.name}`);
                    console.log(`   Description: ${tool.description}`);
                    console.log(`   Schema:`, JSON.stringify(tool.inputSchema, null, 2));
                    
                    return {
                        name: tool.name,
                        description: tool.description,
                        parameters: {
                            type: tool.inputSchema.type,
                            properties: tool.inputSchema.properties,
                            required: tool.inputSchema.required || []
                        }
                    }
                });
                console.log(`Loaded ${tools.length} tools from the server`);
                console.log("Available tools:", tools.map(t => t.name));
                chatLoop();
            } catch (error) {
                console.error("Error loading tools:", error.message);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error("Failed to connect to MCP server:", error.message);
            console.log("Make sure the server is running at http://localhost:3001");
            process.exit(1);
        });
} catch (error) {
    console.error("Error initializing connection:", error.message);
    process.exit(1);
}

const saveConversationState = async () => {
  try {
    // Update state
    conversationState.conversationHistory = conversationHistory;
    conversationState.lastSaved = new Date().toISOString();

    // Save to file
    await saveToJson('./context_for_bot/conversation_state.json', conversationState);
    //console.log("✅ Conversation state saved.");
  } catch (error) {
    console.error("❌ Failed to save conversation state:", error.message);
  }
};



// Helper function to get time ago in human readable format
  function getTimeAgo(pastDate) {
    const seconds = Math.floor((new Date() - new Date(pastDate)) / 1000);
   
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return interval + " years ago";
    if (interval === 1) return "1 year ago";
   
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return interval + " months ago";
    if (interval === 1) return "1 month ago";
   
    interval = Math.floor(seconds / 86400);
    if (interval > 1) return interval + " days ago";
    if (interval === 1) return "1 day ago";
   
    interval = Math.floor(seconds / 3600);
    if (interval > 1) return interval + " hours ago";
    if (interval === 1) return "1 hour ago";
   
    interval = Math.floor(seconds / 60);
    if (interval > 1) return interval + " minutes ago";
    if (interval === 1) return "1 minute ago";
   
    return "just now";
  }



async function chatLoop(toolCall) {
    try {
        conversationState.interactionCount++;
        if (conversationHistory.length > MAX_HISTORY * 2 + 1) {
            conversationHistory.splice(1, 2);
        }

        if (toolCall) {
            // Debounce logic: prevent repeated tool calls for the same input within TOOL_DEBOUNCE_SECONDS
            const now = Date.now();
            const toolArgsString = JSON.stringify(toolCall.args);
            
            // Only apply debounce for YouTube tool calls to avoid blocking other tools
            if (toolCall.name === 'playYouTubeVideo' && 
                lastToolCall.toolName === toolCall.name &&
                lastToolCall.args === toolArgsString &&
                now - lastToolCall.timestamp < TOOL_DEBOUNCE_SECONDS * 1000) {
                
                // Friendly response for repeated tool call
                const friendlyMsg = `I just played that song for you! Want to try something else or play a different song?`;
                conversationHistory.push({
                    role: "model",
                    parts: [
                        { text: friendlyMsg, type: "text" }
                    ]
                });
                console.log(`${botIdentity.name}${getMoodEmoji(botMood.current_mood?.state)} : ${friendlyMsg}`);
                chatLoop();
                return;
            }
            
            // Save this tool call as the last one
            lastToolCall = {
                toolName: toolCall.name,
                args: toolArgsString,
                timestamp: now,
                userInput: null
            };
            // Execute the tool directly
            try {
                console.log(`🔧 Executing tool: ${toolCall.name}`);
                console.log(`📝 Arguments: ${JSON.stringify(toolCall.args, null, 2)}`);

                const result = await mcpClient.callTool({
                    name: toolCall.name,
                    arguments: toolCall.args
                });

                let toolResultText = "Tool execution completed.";

                if (result && Array.isArray(result.content) && result.content.length > 0) {
                    const textContent = result.content.find(item => item.type === "text");
                    if (textContent) {
                        toolResultText = textContent.text;
                    }
                }

                // Add tool result as model response
                conversationHistory.push({
                    role: "model",
                    parts: [
                        {
                            text: toolResultText,
                            type: "text"
                        }
                    ]
                });
                
                console.log("✅ Tool executed successfully:", toolResultText);
                console.log(`${botIdentity.name}${getMoodEmoji(botMood.current_mood?.state)} : ${toolResultText}`);
                
                // Continue the loop without generating another response
                chatLoop();
                return;
            } catch (error) {
                console.error("❌ Tool execution failed:", error.message);
                
                const errorMessage = `I encountered an error while executing the tool: ${error.message}. Let me try a different approach or ask for clarification.`;
                
                conversationHistory.push({
                    role: "model",
                    parts: [
                        {
                            text: errorMessage,
                            type: "text"
                        }
                    ]
                });
                
                console.log(`${botIdentity.name}${getMoodEmoji(botMood.current_mood?.state)} : ${errorMessage}`);
                
                // Continue the loop without generating another response
                chatLoop();
                return;
            }
        } else {
            // Getting the input 
            const question = await rl.question(`You${relationship.relationship ? ` (${relationship.relationship.nickname_for_user})` : ""}: `);

            updateMood(question);
            updateObjectives(question);
            
            // Exit command
            if (question.toLowerCase() === 'exit' || question.toLowerCase() === 'quit') {
                console.log('Goodbye!');
                await saveConversationState();
                await appendToHistoryFile("./context_for_bot/history.txt", "Chat session ended");
                rl.close();
                process.exit(0);
            }
            
            conversationHistory.push({
                role: "user",
                parts: [
                    {
                        text: question,
                        type: "text"
                    }
                ]
            });

            // Ensure system prompt is always present for tool calling
        ensureSystemPromptInContext();
        
        // Add tool calling reminder if conversation is getting long
        if (conversationHistory.length > 10) {
            const lastToolCallTime = lastToolCall.timestamp;
            const timeSinceLastTool = Date.now() - lastToolCallTime;
            
            // If no tools have been called recently and conversation is long, add a reminder
            if (timeSinceLastTool > 5 * 60 * 1000) { // 5 minutes
                conversationHistory.push({
                    role: "user",
                    parts: [{ text: "[REMINDER: Remember to use tools for YouTube, file, and command requests]" }]
                });
            }
        }
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: conversationHistory,
            config: {
                tools: tools.length > 0 ? [{ functionDeclarations: tools }] : []
            }
        });

        let functionCall = null;
        let responseText = "Sorry, I couldn't generate a response.";
        
        if (response && 
            response.candidates && 
            Array.isArray(response.candidates) && 
            response.candidates.length > 0 && 
            response.candidates[0].content && 
            Array.isArray(response.candidates[0].content.parts) && 
            response.candidates[0].content.parts.length > 0) {
            
            functionCall = response.candidates[0].content.parts[0].functionCall;
            responseText = response.candidates[0].content.parts[0].text || responseText;
            
            // Debug logging
            console.log("🔍 Response analysis:");
            console.log("  - Function call detected:", !!functionCall);
            console.log("  - Response text:", responseText);
            if (functionCall) {
                console.log("  - Tool to call:", functionCall.name);
                console.log("  - Tool arguments:", JSON.stringify(functionCall.args));
            }
        }

        // Handle function calls with better context management
        if (functionCall) {
            console.log("🔄 Tool call detected, continuing conversation...");
            // Continue the loop instead of recursive call
            return chatLoop(functionCall);
        }

        // Add bot response to conversation
        conversationHistory.push({
            role: "model",
            parts: [
                {
                    text: responseText,
                    type: "text"
                }
            ]
        });

        // Save conversation state periodically
        if (conversationState.interactionCount % 3 === 0) {
            saveConversationState();
        }

        console.log(`${botIdentity.name}${getMoodEmoji(botMood.current_mood?.state)} : ${responseText}`);
        
        // Continue the loop
        chatLoop();
    } catch (error) {
        console.error("❌ Error in chat loop:", error.message);
        console.log("🔄 Restarting chat loop...");
        // Add error recovery to conversation
        conversationHistory.push({
            role: "model",
            parts: [
                {
                    text: "I encountered an error in our conversation. Let me restart and continue from where we left off.",
                    type: "text"
                }
            ]
        });
        chatLoop();
    }
}

